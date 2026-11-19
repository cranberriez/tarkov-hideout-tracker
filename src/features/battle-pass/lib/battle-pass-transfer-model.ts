import { normalizeCount, parseProgress } from "./battle-pass-model";
import { defaultsEnabled, parseConfiguration } from "./battle-pass-configuration";
import { parseSavedRoute, type LockedRoute, type RouteSettings } from "./saved-route-model";
import { parsePreferences, type BattlePassPreferences } from "./battle-pass-preferences";
import { parseFundingSettings, type FundingSettings } from "./funding-settings-model";

/** Battle-pass-only backup: one season's progress, costs and plan plus the shared settings it plans with. */
export const TRANSFER_KIND = "tarkov-battle-pass-export";
export const TRANSFER_VERSION = 1;

/** Page toggles that change what gets planned; pure view state (list view, panel expansion) is left out. */
export const PLANNING_PREFERENCES = [
	"requestedScope",
	"useClassified",
	"optimizerEnabled",
	"showProfileRecommendations",
] as const satisfies readonly (keyof BattlePassPreferences)[];
type PlanningPreference = (typeof PLANNING_PREFERENCES)[number];

export type TransferStore = "progress" | "costs" | "route" | "funding" | "preferences";
/** Latest raw value of each battle-pass storage key. */
export type TransferSources = Record<TransferStore, string | null>;

export interface TransferContext {
	seasonId: string;
	seasonName: (id: string) => string;
	tiles: { id: string; displayName: string }[];
	documents: { key: string; name: string }[];
	/** Profiles available on this device, with current ordinary document counts. */
	profiles: { key: string; label: string; inventory: Record<string, number> }[];
}

export interface BattlePassExport {
	kind: typeof TRANSFER_KIND;
	version: typeof TRANSFER_VERSION;
	seasonId: string;
	exportedAt: string;
	documents: Record<string, Record<string, number>>;
	progress: { completed: string[]; goals: string[]; classified: number; avoidedDocuments: string[] };
	costs: { useDefaults: boolean; rewards: ReturnType<typeof parseConfiguration> };
	route: { settings: RouteSettings; locked: LockedRoute | null };
	funding: FundingSettings;
	preferences: Pick<BattlePassPreferences, PlanningPreference>;
}

export function buildExport(sources: TransferSources, context: TransferContext, now = new Date()): BattlePassExport {
	const progress = parseProgress(sources.progress);
	const preferences = parsePreferences(sources.preferences);
	return {
		kind: TRANSFER_KIND,
		version: TRANSFER_VERSION,
		seasonId: context.seasonId,
		exportedAt: now.toISOString(),
		documents: Object.fromEntries(context.profiles.map((profile) => [profile.key, { ...profile.inventory }])),
		progress: {
			completed: progress.completed,
			goals: progress.goals,
			classified: progress.classified,
			avoidedDocuments: progress.avoidedDocuments,
		},
		costs: { useDefaults: defaultsEnabled(sources.costs), rewards: parseConfiguration(sources.costs) },
		route: parseSavedRoute(sources.route),
		funding: parseFundingSettings(sources.funding),
		preferences: Object.fromEntries(PLANNING_PREFERENCES.map((key) => [key, preferences[key]])) as Pick<
			BattlePassPreferences,
			PlanningPreference
		>,
	};
}

export const exportFileName = (seasonId: string, now = new Date()) =>
	`battle-pass-${seasonId}-${now.toISOString().slice(0, 10)}.json`;

export type TransferChange =
	| { type: "field"; store: TransferStore; field: string; value: unknown }
	| { type: "document"; profile: string; key: string; value: number }
	| { type: "goal"; id: string; add: boolean };

export interface TransferRow {
	id: string;
	label: string;
	current: string;
	incoming: string;
	change: TransferChange;
}

export interface TransferSection {
	id: string;
	title: string;
	rows: TransferRow[];
}

export type ImportReview =
	{ ok: false; errors: string[] } | { ok: true; warnings: string[]; sections: TransferSection[]; exportedAt: string };

const record = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const has = (value: Record<string, unknown>, key: string) => Object.hasOwn(value, key);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const onOff = (value: boolean) => (value ? "On" : "Off");
const list = (values: string[], empty = "None") => (values.length ? values.join(", ") : empty);

/** Validate a file and list every value it would change, grouped by section. Writes nothing. */
export function reviewImport(text: string, sources: TransferSources, context: TransferContext): ImportReview {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return { ok: false, errors: ["This file is not valid JSON."] };
	}
	const file = record(parsed);
	if (file.kind !== TRANSFER_KIND) return { ok: false, errors: ["This is not a battle pass export."] };
	if (typeof file.version !== "number" || file.version > TRANSFER_VERSION)
		return { ok: false, errors: ["This export was made by a newer version of the site. Reload and try again."] };
	if (file.seasonId !== context.seasonId)
		return {
			ok: false,
			errors: [
				`This file is for the ${typeof file.seasonId === "string" ? context.seasonName(file.seasonId) : "unknown"} battle pass; you are viewing ${context.seasonName(context.seasonId)}.`,
			],
		};

	const warnings: string[] = [];
	const sections: TransferSection[] = [];
	const tileNames = new Map(context.tiles.map((tile) => [tile.id, tile.displayName]));
	const documentNames = new Map(context.documents.map((doc) => [doc.key, doc.name]));
	const profileLabels = new Map(context.profiles.map((profile) => [profile.key, profile.label]));
	const knownRewards = (ids: string[], what: string) => {
		const known = ids.filter((id) => tileNames.has(id));
		if (known.length < ids.length)
			warnings.push(`${plural(ids.length - known.length, "unknown reward")} in ${what} skipped.`);
		return known;
	};
	const field = (
		store: TransferStore,
		name: string,
		label: string,
		current: string,
		incoming: string,
		value: unknown,
	) => ({
		id: `${store}.${name}`,
		label,
		current,
		incoming,
		change: { type: "field", store, field: name, value } as const,
	});

	// Documents: one section per account, one row per changed count.
	for (const [profileKey, counts] of Object.entries(record(file.documents))) {
		const profile = context.profiles.find((entry) => entry.key === profileKey);
		if (!profile) {
			warnings.push(
				profileKey === context.seasonId
					? `Your ${context.seasonName(profileKey)} character isn't activated here; its documents were skipped.`
					: `Documents for unknown account "${profileKey}" skipped.`,
			);
			continue;
		}
		const rows: TransferRow[] = [];
		for (const [key, value] of Object.entries(record(counts))) {
			if (!documentNames.has(key)) continue;
			const incoming = normalizeCount(value);
			const current = profile.inventory[key] ?? 0;
			if (incoming === current) continue;
			rows.push({
				id: `documents.${profileKey}.${key}`,
				label: documentNames.get(key)!,
				current: String(current),
				incoming: String(incoming),
				change: { type: "document", profile: profileKey, key, value: incoming },
			});
		}
		sections.push({ id: `documents.${profileKey}`, title: `${profile.label} documents`, rows });
	}

	const progress = parseProgress(sources.progress);
	const incomingProgress = record(file.progress);
	const fileProgress = parseProgress(JSON.stringify(incomingProgress));
	if (has(incomingProgress, "completed")) {
		// Rewards this build doesn't know stay in the save, as every other writer keeps them.
		const kept = progress.completed.filter((id) => !tileNames.has(id));
		const completed = knownRewards(fileProgress.completed, "completed rewards");
		const now = new Set(progress.completed);
		const next = new Set(completed);
		const added = completed.filter((id) => !now.has(id)).length;
		const removed = progress.completed.filter((id) => tileNames.has(id) && !next.has(id)).length;
		sections.push({
			id: "completed",
			title: "Completed rewards",
			rows:
				added || removed
					? [
							field(
								"progress",
								"completed",
								`Claimed rewards (+${added}, −${removed})`,
								String(progress.completed.length - kept.length),
								String(completed.length),
								[...completed, ...kept],
							),
						]
					: [],
		});
	}
	if (has(incomingProgress, "goals")) {
		const goals = knownRewards(fileProgress.goals, "goals");
		const now = new Set(progress.goals);
		const next = new Set(goals);
		const name = (id: string) => tileNames.get(id) ?? id;
		sections.push({
			id: "goals",
			title: "Goals",
			rows: [
				...goals
					.filter((id) => !now.has(id))
					.map((id) => ({
						id: `goals.add.${id}`,
						label: name(id),
						current: "Not a goal",
						incoming: "Goal",
						change: { type: "goal", id, add: true } as const,
					})),
				...progress.goals
					.filter((id) => !next.has(id))
					.map((id) => ({
						id: `goals.remove.${id}`,
						label: name(id),
						current: "Goal",
						incoming: "Not a goal",
						change: { type: "goal", id, add: false } as const,
					})),
			],
		});
	}
	const documentRows: TransferRow[] = [];
	if (has(incomingProgress, "classified") && fileProgress.classified !== progress.classified)
		documentRows.push(
			field(
				"progress",
				"classified",
				"Classified documents",
				String(progress.classified),
				String(fileProgress.classified),
				fileProgress.classified,
			),
		);
	if (has(incomingProgress, "avoidedDocuments")) {
		const avoided = fileProgress.avoidedDocuments.filter((key) => documentNames.has(key));
		if (!same([...avoided].sort(), [...progress.avoidedDocuments].sort())) {
			const names = (keys: string[]) => list(keys.map((key) => documentNames.get(key) ?? key));
			documentRows.push(
				field(
					"progress",
					"avoidedDocuments",
					"Documents not collected",
					names(progress.avoidedDocuments),
					names(avoided),
					avoided,
				),
			);
		}
	}
	if (has(incomingProgress, "classified") || has(incomingProgress, "avoidedDocuments"))
		sections.push({ id: "collection", title: "Classified & collection", rows: documentRows });

	const costs = record(file.costs);
	if (has(costs, "rewards") || has(costs, "useDefaults")) {
		const rows: TransferRow[] = [];
		if (has(costs, "rewards")) {
			const parsedRewards = parseConfiguration(JSON.stringify({ rewards: costs.rewards }));
			const rewards = Object.fromEntries(Object.entries(parsedRewards).filter(([id]) => tileNames.has(id)));
			const skipped = Object.keys(parsedRewards).length - Object.keys(rewards).length;
			if (skipped) warnings.push(`${plural(skipped, "unknown reward")} in custom costs skipped.`);
			const current = Object.fromEntries(
				Object.entries(parseConfiguration(sources.costs)).filter(([id]) => tileNames.has(id)),
			);
			const unknown = Object.fromEntries(
				Object.entries(record(decode(sources.costs).rewards)).filter(([id]) => !tileNames.has(id)),
			);
			const ids = new Set([...Object.keys(current), ...Object.keys(rewards)]);
			const differing = [...ids].filter((id) => !same(current[id], rewards[id])).length;
			if (differing)
				rows.push(
					field(
						"costs",
						"rewards",
						`Custom costs (${plural(differing, "reward")} differ)`,
						plural(Object.keys(current).length, "reward"),
						plural(Object.keys(rewards).length, "reward"),
						{ ...unknown, ...rewards },
					),
				);
		}
		if (has(costs, "useDefaults")) {
			const incoming = costs.useDefaults === true;
			const current = defaultsEnabled(sources.costs);
			if (incoming !== current)
				rows.push(field("costs", "useDefaults", "Use Defaults", onOff(current), onOff(incoming), incoming));
		}
		sections.push({ id: "costs", title: "Document costs", rows });
	}

	const route = record(file.route);
	if (has(route, "settings") || has(route, "locked")) {
		const current = parseSavedRoute(sources.route);
		const incoming = parseSavedRoute(JSON.stringify(route));
		const rows: TransferRow[] = [];
		const describeSettings = (settings: RouteSettings) =>
			[
				settings.destination === "finish"
					? "Finish season"
					: settings.destination === "owned"
						? "Most rewards now"
						: settings.destination === "goals"
							? "Goals"
							: (tileNames.get(settings.destination) ?? "Unknown reward"),
				settings.buyAll ? "Buy all rewards" : "Needed rewards",
				settings.allProfiles ? "All profiles" : "One profile",
			].join(" · ");
		const describePlan = (locked: LockedRoute | null) =>
			locked
				? `${plural(locked.claims.length, "claim")}${locked.savedAt ? `, saved ${locked.savedAt.slice(0, 10)}` : ""}`
				: "None";
		if (has(route, "settings") && !same(current.settings, incoming.settings))
			rows.push(
				field(
					"route",
					"settings",
					"Route settings",
					describeSettings(current.settings),
					describeSettings(incoming.settings),
					incoming.settings,
				),
			);
		if (has(route, "locked")) {
			if (route.locked !== null && !incoming.locked)
				warnings.push("The saved plan in this file is unreadable and was skipped.");
			else if (!same(current.locked, incoming.locked)) {
				const unknown = incoming.locked?.claims.filter((claim) => !tileNames.has(claim.rewardId)).length ?? 0;
				if (unknown)
					warnings.push(`The saved plan references ${plural(unknown, "unknown reward")}; it will ask to re-optimize.`);
				rows.push(
					field(
						"route",
						"locked",
						"Saved plan",
						describePlan(current.locked),
						describePlan(incoming.locked),
						incoming.locked,
					),
				);
			}
		}
		sections.push({ id: "plan", title: "Plan", rows });
	}

	const funding = record(file.funding);
	if (Object.keys(funding).length) {
		const current = parseFundingSettings(sources.funding);
		const incoming = parseFundingSettings(JSON.stringify(funding));
		const modeName = (key: string | null) =>
			key === null ? "No preference" : (profileLabels.get(key) ?? context.seasonName(key));
		const filters = (value: FundingSettings["gatheringFilters"]) => {
			const parts = Object.entries(value)
				.filter(([, filter]) => filter.disabled || (filter.excluded?.length ?? 0))
				.map(
					([key, filter]) =>
						`${modeName(key)}: ${filter.disabled ? "off" : `${filter.excluded?.length ?? 0} excluded`}`,
				);
			return list(parts, "Every document");
		};
		const formats: { [K in keyof FundingSettings]: [string, (value: FundingSettings[K]) => string] } = {
			startingTarCoins: ["Starting TarCoins", String],
			allowSpecial: ["One-time offer", onOff],
			preferredMode: ["Preferred gathering mode", modeName],
			dailyHeadroom: ["Daily headroom", onOff],
			gatheringTarget: [
				"Gathering target",
				(value) => (value === null ? "Recommended" : value === 0 ? "None" : `${value} documents`),
			],
			gatheringFilters: ["Gathering documents", filters],
			gatheringMaps: ["Maps to farm", (value) => (value === null ? "Every map" : list(value))],
		};
		const rows: TransferRow[] = [];
		for (const key of Object.keys(formats) as (keyof FundingSettings)[]) {
			if (!has(funding, key) || same(current[key], incoming[key])) continue;
			const [label, format] = formats[key] as [string, (value: unknown) => string];
			rows.push(field("funding", key, label, format(current[key]), format(incoming[key]), incoming[key]));
		}
		sections.push({ id: "funding", title: "Funding & gathering", rows });
	}

	const preferences = record(file.preferences);
	if (Object.keys(preferences).length) {
		const current = parsePreferences(sources.preferences);
		const incoming = parsePreferences(JSON.stringify(preferences));
		const labels: Record<PlanningPreference, string> = {
			requestedScope: "Plan scope",
			useClassified: "Use classified documents",
			optimizerEnabled: "Docs optimizer",
			showProfileRecommendations: "Profile recommendations",
		};
		const format = (key: PlanningPreference, value: unknown) =>
			key === "requestedScope" ? (value === "all" ? "Everything" : "Goals") : onOff(value === true);
		const rows = PLANNING_PREFERENCES.filter((key) => has(preferences, key) && current[key] !== incoming[key]).map(
			(key) =>
				field("preferences", key, labels[key], format(key, current[key]), format(key, incoming[key]), incoming[key]),
		);
		sections.push({ id: "preferences", title: "Page toggles", rows });
	}

	if (!sections.length) return { ok: false, errors: ["This file contains no battle pass data."] };
	return { ok: true, warnings, sections, exportedAt: typeof file.exportedAt === "string" ? file.exportedAt : "" };
}

const decode = (raw: string | null) => {
	try {
		return record(JSON.parse(raw ?? "null"));
	} catch {
		return {};
	}
};

/** Storage transforms for the chosen rows. Each merges into the latest save and keeps unknown fields. */
export function importWrites(changes: TransferChange[]) {
	const fields = new Map<TransferStore, Record<string, unknown>>();
	const goals = changes.filter((change) => change.type === "goal");
	const documents = changes.filter((change) => change.type === "document");
	for (const change of changes)
		if (change.type === "field")
			fields.set(change.store, { ...fields.get(change.store), [change.field]: change.value });
	const writes = new Map<TransferStore, (raw: string | null) => string>();
	for (const [store, patch] of fields)
		writes.set(store, (raw) =>
			JSON.stringify(
				store === "preferences" ? { ...parsePreferences(raw), ...patch } : { version: 1, ...decode(raw), ...patch },
			),
		);
	if (goals.length) {
		const progressFields = writes.get("progress");
		writes.set("progress", (raw) => {
			const merged = progressFields ? progressFields(raw) : raw;
			const current = parseProgress(merged).goals;
			const removed = new Set(goals.filter((goal) => !goal.add).map((goal) => goal.id));
			const next = [
				...current.filter((id) => !removed.has(id)),
				...goals.filter((goal) => goal.add && !current.includes(goal.id)).map((goal) => goal.id),
			];
			return JSON.stringify({ version: 1, ...decode(merged), goals: next });
		});
	}
	return { writes, documents };
}
