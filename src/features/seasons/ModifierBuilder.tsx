"use client";

import { createContext, use, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Check, Link2, RotateCcw, Save, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
	BUILD_PARAM,
	builderTotals,
	decodeBuild,
	encodeBuild,
	parsePicks,
	PICKS_PARAM,
	serializePicks,
} from "./modifiers/builder";
import { formatPoints } from "./modifiers/types";
import { BuildScreenshotButton } from "./BuildScreenshot";

/** Serializable personal modifier facts the builder, share link and screenshot need. */
export type BuilderModifier = {
	id: string;
	name: string;
	kind: "positive" | "negative";
	points: number;
	icon?: string;
};

type Selection = { selected: ReadonlySet<string>; toggle: (id: string) => void; reset: () => void };
/** Set while viewing someone else's `?b=` link: edits stay in the URL and never overwrite the saved build. */
type SharedView = { backToMine: () => void; saveAsMine: () => void };
type Builder = {
	selection: Selection;
	modifiers: BuilderModifier[];
	seasonId: string;
	seasonLabel: string;
	shared: SharedView | null;
};
const BuilderContext = createContext<Builder | null>(null);

export const useModifierBuilder = () => use(BuilderContext);

/** The URL's compact `b` query is the selection's single source of truth (and the share link). */
const buildListeners = new Set<() => void>();
const readBuild = () => new URLSearchParams(location.search).get(BUILD_PARAM) ?? "";
function subscribeToBuild(listener: () => void) {
	buildListeners.add(listener);
	window.addEventListener("popstate", listener);
	return () => {
		buildListeners.delete(listener);
		window.removeEventListener("popstate", listener);
	};
}
/**
 * Global, profile-independent convenience copy of a season's picks (readable comma-separated IDs)
 * so returning without `?b=` restores the last build. Storage may be unavailable; the URL still works.
 */
const picksStorageKey = (seasonId: string) => `tarkov-season-picks-${seasonId}-v1`;
function loadSavedPicks(seasonId: string) {
	try {
		return localStorage.getItem(picksStorageKey(seasonId)) ?? "";
	} catch {
		return "";
	}
}
function savePicks(seasonId: string, value: string) {
	try {
		if (value) localStorage.setItem(picksStorageKey(seasonId), value);
		else localStorage.removeItem(picksStorageKey(seasonId));
	} catch {
		// Storage unavailable: the selection still lives in the URL.
	}
}

/** Replaces `?b=` (dropping any legacy `?picks=`) without a navigation, then notifies subscribers. */
function writeBuild(code: string) {
	const url = new URL(location.href);
	url.searchParams.delete(PICKS_PARAM);
	if (code) url.searchParams.set(BUILD_PARAM, code);
	else url.searchParams.delete(BUILD_PARAM);
	history.replaceState(history.state, "", url);
	buildListeners.forEach((listener) => listener());
}

/**
 * Personal modifier selections for one season page. The selection lives in the URL's compact `b`
 * query (read on load, replaced as it changes), so the address bar is always the share link.
 */
export function ModifierBuilderProvider({
	seasonId,
	modifiers,
	shareOrder,
	seasonLabel,
	children,
}: {
	seasonId: string;
	modifiers: BuilderModifier[];
	shareOrder: readonly string[];
	seasonLabel: string;
	children: ReactNode;
}) {
	const ids = useMemo(() => modifiers.map((modifier) => modifier.id), [modifiers]);
	const code = useSyncExternalStore(subscribeToBuild, readBuild, () => "");
	const selected = useMemo(() => decodeBuild(code, shareOrder), [code, shareOrder]);
	const [viewingShared, setViewingShared] = useState(false);
	// A `?b=` link wins; a legacy `?picks=` link is converted; otherwise restore the saved build.
	// A link that differs from a non-empty saved build opens as a shared view so edits can't clobber it.
	useEffect(() => {
		const params = new URLSearchParams(location.search);
		const savedCode = encodeBuild(parsePicks(loadSavedPicks(seasonId), ids), shareOrder);
		if (params.has(BUILD_PARAM)) {
			const linkCode = encodeBuild(decodeBuild(params.get(BUILD_PARAM) ?? "", shareOrder), shareOrder);
			// eslint-disable-next-line react-hooks/set-state-in-effect -- location is client-only; read once on mount.
			setViewingShared(savedCode !== "" && linkCode !== savedCode);
			return;
		}
		const restored = params.has(PICKS_PARAM)
			? encodeBuild(parsePicks(params.get(PICKS_PARAM), ids), shareOrder)
			: savedCode;
		if (restored || params.has(PICKS_PARAM)) writeBuild(restored);
	}, [seasonId, ids, shareOrder]);
	const builder = useMemo<Builder>(() => {
		const commit = (next: ReadonlySet<string>) => {
			writeBuild(encodeBuild(next, shareOrder));
			if (!viewingShared) savePicks(seasonId, serializePicks(next, ids));
		};
		return {
			modifiers,
			seasonId,
			seasonLabel,
			shared: viewingShared
				? {
						backToMine: () => {
							writeBuild(encodeBuild(parsePicks(loadSavedPicks(seasonId), ids), shareOrder));
							setViewingShared(false);
						},
						saveAsMine: () => {
							savePicks(seasonId, serializePicks(decodeBuild(readBuild(), shareOrder), ids));
							setViewingShared(false);
						},
					}
				: null,
			selection: {
				selected,
				toggle: (id) => {
					// Read the live URL, not the render snapshot, so rapid toggles never drop one.
					const next = decodeBuild(readBuild(), shareOrder);
					if (!next.delete(id)) next.add(id);
					commit(next);
				},
				reset: () => commit(new Set()),
			},
		};
	}, [modifiers, seasonLabel, selected, ids, seasonId, shareOrder, viewingShared]);
	return <BuilderContext value={builder}>{children}</BuilderContext>;
}

/** Copies the current page URL, which carries the picks, and confirms for a second. */
function ShareButton() {
	const [copied, setCopied] = useState(false);
	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(false), 1200);
		return () => clearTimeout(timer);
	}, [copied]);
	return (
		<button
			type="button"
			onClick={async () => {
				try {
					await navigator.clipboard.writeText(location.href);
					setCopied(true);
				} catch {
					window.prompt("Copy this link", location.href);
				}
			}}
			className="inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1 text-xs font-semibold transition-colors hover:bg-surface-raised/70"
		>
			{copied ? <Check aria-hidden className="size-3.5 text-success" /> : <Link2 aria-hidden className="size-3.5" />}
			{copied ? "Copied" : "Share"}
		</button>
	);
}

/** A personal modifier card that toggles on click anywhere, with a check circle in its top-left corner. */
export function SelectableCard({
	id,
	name,
	kind,
	className,
	children,
}: {
	id: string;
	name: string;
	kind: "positive" | "negative";
	className: string;
	children: ReactNode;
}) {
	const selection = use(BuilderContext)?.selection;
	const checked = selection?.selected.has(id) ?? false;
	return (
		<li className="flex">
			<button
				type="button"
				aria-pressed={checked}
				aria-label={`${checked ? "Remove" : "Add"} ${name}`}
				onClick={() => selection?.toggle(id)}
				className={cn(
					"relative flex w-full cursor-pointer flex-col rounded-lg p-3 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground",
					className,
					kind === "positive"
						? "hover:shadow-[0_0_14px_color-mix(in_oklab,var(--success)_28%,transparent)]"
						: "hover:shadow-[0_0_14px_color-mix(in_oklab,var(--danger)_28%,transparent)]",
					checked && (kind === "positive" ? "ring-1 ring-success/60" : "ring-1 ring-danger/60"),
				)}
			>
				{children}
			</button>
		</li>
	);
}

/**
 * Points chip that doubles as the selection indicator: "−2 ○", filling solid with a check when the
 * card is selected. Display only; the whole card is the toggle.
 */
export function PointsToggleChip({
	id,
	points,
	kind,
	label,
}: {
	id: string;
	points: string;
	kind: "positive" | "negative";
	label: string;
}) {
	const checked = use(BuilderContext)?.selection.selected.has(id) ?? false;
	return (
		<span
			aria-label={label}
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full py-0.5 pl-2.5 pr-1.5 text-sm font-semibold normal-case tracking-normal tabular-nums",
				checked
					? kind === "positive"
						? "bg-modifier-picked-positive text-modifier-picked-foreground"
						: "bg-modifier-picked-negative text-modifier-picked-foreground"
					: kind === "positive"
						? "bg-success/18 text-foreground"
						: "bg-danger/18 text-foreground",
			)}
		>
			{points}
			{/* SVG keeps the ring even when the card lands on a sub-pixel (fractional grid columns). */}
			<svg aria-hidden viewBox="0 0 14 14" className="size-3.5">
				{checked ? (
					<path
						d="M3.5 7.2 6 9.6 10.5 4.8"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.2"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				) : (
					// Unselected: a solid "hole" in the page background color.
					<circle cx="7" cy="7" r="6" fill="var(--background)" />
				)}
			</svg>
		</span>
	);
}

/** Point totals for the current selection; sticks near the top while scrolling the personal lists. */
export function ModifierBuilderBar() {
	const builder = use(BuilderContext);
	const bar = useRef<HTMLDivElement>(null);
	const [stuck, setStuck] = useState(false);
	useEffect(() => {
		const sync = () => setStuck(!!bar.current && bar.current.getBoundingClientRect().top <= 0);
		sync();
		window.addEventListener("scroll", sync, { passive: true });
		window.addEventListener("resize", sync);
		return () => {
			window.removeEventListener("scroll", sync);
			window.removeEventListener("resize", sync);
		};
	}, []);
	if (!builder) return null;
	const { selection, modifiers, shared } = builder;
	const totals = builderTotals(
		selection.selected,
		Object.fromEntries(modifiers.map((modifier) => [modifier.id, modifier.points])),
	);
	return (
		<div
			ref={bar}
			role="status"
			aria-live="polite"
			className={cn(
				"sticky top-0 z-20 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg px-4 py-2.5 text-sm shadow-lg backdrop-blur",
				// A shared link swaps to the raised gray so it never reads as the viewer's own build.
				shared ? "bg-surface-raised/95" : "bg-card/95",
				// Pinned to the top edge: square top corners, thin border on the sides and bottom only.
				stuck && "rounded-t-none border-x border-b border-border",
			)}
		>
			<span className="font-semibold" title={shared ? "Edits here won't replace your saved build" : undefined}>
				{shared ? "Shared build" : "Your build"}
			</span>
			<span className="text-foreground/85">
				Granted <span className="font-semibold tabular-nums text-foreground">+{totals.granted}</span>
			</span>
			<span className="text-foreground/85">
				Spent <span className="font-semibold tabular-nums text-foreground">−{totals.spent}</span>
			</span>
			<span className="text-foreground/85">
				Balance{" "}
				<span className={cn("font-semibold tabular-nums", totals.valid ? "text-success" : "text-danger")}>
					{totals.balance === 0 ? "0" : formatPoints(totals.balance)}
				</span>
			</span>
			<span
				className={cn(
					"rounded-full px-2.5 py-0.5 text-xs font-semibold",
					totals.valid ? "bg-success/18 text-foreground" : "bg-danger/18 text-foreground",
				)}
			>
				{totals.valid ? "Valid" : `Over budget by ${-totals.balance}`}
			</span>
			<span className="ml-auto text-xs text-foreground/85 tabular-nums">{totals.count} selected</span>
			{shared ? (
				<>
					<button
						type="button"
						onClick={shared.backToMine}
						className="inline-flex items-center gap-1.5 rounded-md bg-card px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-card/70"
					>
						<Undo2 aria-hidden className="size-3.5" />
						Back to mine
					</button>
					<button
						type="button"
						onClick={shared.saveAsMine}
						className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1 text-xs font-semibold text-background transition-colors hover:bg-foreground/85"
					>
						<Save aria-hidden className="size-3.5" />
						Save as mine
					</button>
				</>
			) : (
				<>
					<button
						type="button"
						onClick={selection.reset}
						disabled={totals.count === 0}
						className="inline-flex items-center gap-1.5 rounded-md bg-surface-raised px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-surface-raised/70 disabled:opacity-50"
					>
						<RotateCcw aria-hidden className="size-3.5" />
						Reset
					</button>
					<ShareButton />
					<BuildScreenshotButton />
				</>
			)}
		</div>
	);
}
