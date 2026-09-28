import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TarkovDataMode } from "../../src/types/common";
import type { PriceHistoryPoint } from "../../src/types/prices";

export type ExclusionReason = "not-found" | "no-history";

export interface ItemState {
	etag: string | null;
	checkedAt: number;
	/** Latest upstream point in the cached history file; null when nothing is cached. */
	latestTimestamp: number | null;
	/** The cached history is newer than the last successful PostgreSQL push. */
	dirty?: boolean;
	/** Latest upstream point covered by the last analytics observation. */
	analyzedTimestamp?: number;
	/** Not listed on the flea in this mode; skipped until a recheck is requested. */
	excluded?: { reason: ExclusionReason; at: number };
}

export interface PollCounts {
	checked: number;
	updated: number;
	notModified: number;
	failed: number;
	excluded: number;
}

export interface ModeState {
	version: 1;
	items: Record<string, ItemState>;
	eligibleIds: string[];
	eligibleAt: number | null;
	/** Transient upstream failures awaiting their sync-state push. */
	pendingFailures: Record<string, { checkedAt: number; error: string }>;
	/** Poll activity since the last flush, reported in its run summary. */
	sinceFlush: PollCounts;
	lastPollAt: number | null;
	lastFlushAt: number | null;
	lastCatalogAt: number | null;
	lastAnalysisAt: number | null;
}

export function emptyCounts(): PollCounts {
	return { checked: 0, updated: 0, notModified: 0, failed: 0, excluded: 0 };
}

export function emptyModeState(): ModeState {
	return {
		version: 1,
		items: {},
		eligibleIds: [],
		eligibleAt: null,
		pendingFailures: {},
		sinceFlush: emptyCounts(),
		lastPollAt: null,
		lastFlushAt: null,
		lastCatalogAt: null,
		lastAnalysisAt: null,
	};
}

/** Compact on-disk history rows: [timestamp, price, priceMin, offerCount]. */
type HistoryRow = [number, number, number, number | null];

interface HistoryFile {
	etag: string | null;
	fetchedAt: number;
	points: HistoryRow[];
}

function writeAtomic(file: string, contents: string) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	// Unique per write: containers all run as PID 1, so a PID alone can collide.
	const temporary = `${file}.${randomUUID()}.tmp`;
	fs.writeFileSync(temporary, contents);
	fs.renameSync(temporary, file);
}

function readJson<T>(file: string): T | null {
	try {
		return JSON.parse(fs.readFileSync(file, "utf8")) as T;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
}

/**
 * Worker-local state on the VPS volume. Full upstream histories are cached here
 * (never in PostgreSQL) so analytics avoid refetching and ETags survive restarts.
 * Dirty flags make the cache the push buffer, so a restart cannot lose changes.
 */
export class WorkerStateStore {
	constructor(readonly directory: string) {}

	private modeFile(mode: TarkovDataMode) {
		return path.join(this.directory, "modes", `${mode}.json`);
	}

	private historyFile(mode: TarkovDataMode, itemId: string) {
		if (!/^[A-Za-z0-9_-]+$/.test(itemId)) throw new Error(`Refusing unsafe item id ${itemId}`);
		return path.join(this.directory, "history", mode, `${itemId}.json`);
	}

	private recheckFile(mode: TarkovDataMode) {
		return path.join(this.directory, "requests", `recheck-excluded-${mode}`);
	}

	loadMode(mode: TarkovDataMode): ModeState {
		const stored = readJson<ModeState>(this.modeFile(mode));
		if (!stored) return emptyModeState();
		if (stored.version !== 1) throw new Error(`Unsupported worker state version for ${mode}`);
		return { ...emptyModeState(), ...stored, sinceFlush: { ...emptyCounts(), ...stored.sinceFlush } };
	}

	saveMode(mode: TarkovDataMode, state: ModeState) {
		writeAtomic(this.modeFile(mode), JSON.stringify(state));
	}

	readHistory(mode: TarkovDataMode, itemId: string): PriceHistoryPoint[] | null {
		const stored = readJson<HistoryFile>(this.historyFile(mode, itemId));
		return (
			stored?.points.map(([timestamp, price, priceMin, offerCount]) => ({ timestamp, price, priceMin, offerCount })) ??
			null
		);
	}

	writeHistory(mode: TarkovDataMode, itemId: string, points: readonly PriceHistoryPoint[], etag: string | null) {
		const file: HistoryFile = {
			etag,
			fetchedAt: Date.now(),
			points: points.map((point) => [point.timestamp, point.price, point.priceMin, point.offerCount]),
		};
		writeAtomic(this.historyFile(mode, itemId), JSON.stringify(file));
	}

	/** Asks a running (or the next) worker to check excluded items again. */
	requestRecheck(mode: TarkovDataMode) {
		writeAtomic(this.recheckFile(mode), String(Date.now()));
	}

	/** Queues steps for a running (or the next) worker; see run-spec.ts for the format. */
	requestRun(spec: string) {
		writeAtomic(path.join(this.directory, "requests", `run-now-${Date.now()}-${randomUUID()}.txt`), spec);
	}

	hasRunRequests(): boolean {
		return this.runRequestFiles().length > 0;
	}

	/** Returns queued run specs, oldest first, removing them. */
	consumeRunRequests(): string[] {
		return this.runRequestFiles().flatMap((file) => {
			try {
				const spec = fs.readFileSync(file, "utf8");
				fs.rmSync(file, { force: true });
				return [spec];
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
				throw error;
			}
		});
	}

	private runRequestFiles(): string[] {
		const directory = path.join(this.directory, "requests");
		try {
			return fs
				.readdirSync(directory)
				.filter((name) => name.startsWith("run-now-") && name.endsWith(".txt"))
				.sort()
				.map((name) => path.join(directory, name));
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
			throw error;
		}
	}

	consumeRecheck(mode: TarkovDataMode): boolean {
		try {
			fs.unlinkSync(this.recheckFile(mode));
			return true;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
			throw error;
		}
	}

	private lockFile() {
		return path.join(this.directory, "worker.lock");
	}

	readLock(): LockRecord | null {
		return readJson<LockRecord>(this.lockFile());
	}

	/**
	 * Claims the state directory for one worker. Two workers sharing a volume would
	 * overwrite each other's state and cache files. Returns the live holder on refusal.
	 */
	acquireLock(self: LockRecord, staleMs: number, isPidAlive = pidAlive): LockRecord | null {
		const holder = this.readLock();
		if (holder && holder.instanceId !== self.instanceId && lockHolderAlive(holder, self, staleMs, isPidAlive))
			return holder;
		writeAtomic(this.lockFile(), JSON.stringify(self));
		return null;
	}

	/** Refreshes our claim; false when another instance has taken the directory over. */
	refreshLock(self: LockRecord): boolean {
		const holder = this.readLock();
		if (holder && holder.instanceId !== self.instanceId) return false;
		self.heartbeatAt = Date.now();
		writeAtomic(this.lockFile(), JSON.stringify(self));
		return true;
	}

	releaseLock(self: LockRecord) {
		if (this.readLock()?.instanceId !== self.instanceId) return;
		fs.rmSync(this.lockFile(), { force: true });
	}

	heartbeat(details: object) {
		writeAtomic(path.join(this.directory, "heartbeat.json"), JSON.stringify({ at: Date.now(), ...details }));
	}
}

/** Clears exclusions so every eligible item is checked on the next poll. Returns the count cleared. */
export function clearExclusions(state: ModeState): number {
	let cleared = 0;
	for (const item of Object.values(state.items)) {
		if (!item.excluded) continue;
		delete item.excluded;
		cleared += 1;
	}
	return cleared;
}

/** Adopts a new eligible list and forgets items that left the catalog. */
export function setEligible(state: ModeState, itemIds: readonly string[], at: number) {
	state.eligibleIds = [...itemIds];
	state.eligibleAt = at;
	const eligible = new Set(itemIds);
	for (const itemId of Object.keys(state.items)) if (!eligible.has(itemId)) delete state.items[itemId];
	for (const itemId of Object.keys(state.pendingFailures))
		if (!eligible.has(itemId)) delete state.pendingFailures[itemId];
}

export interface LockRecord {
	instanceId: string;
	hostname: string;
	pid: number;
	heartbeatAt: number;
}

export function newLockRecord(): LockRecord {
	return { instanceId: randomUUID(), hostname: os.hostname(), pid: process.pid, heartbeatAt: Date.now() };
}

function pidAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === "EPERM";
	}
}

/**
 * Whether a recorded holder is still running. A restarted container keeps its
 * hostname and runs as the same PID, so that record is our own previous life.
 */
export function lockHolderAlive(
	holder: LockRecord,
	self: LockRecord,
	staleMs: number,
	isPidAlive: (pid: number) => boolean,
): boolean {
	if (self.heartbeatAt - holder.heartbeatAt > staleMs) return false;
	if (holder.hostname !== self.hostname) return true;
	return holder.pid !== self.pid && isPidAlive(holder.pid);
}
