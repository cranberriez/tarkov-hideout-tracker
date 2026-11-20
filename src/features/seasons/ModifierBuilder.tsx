"use client";

import { createContext, use, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Check, Link2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { builderTotals, parsePicks, PICKS_PARAM, serializePicks } from "./modifiers/builder";
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
type Builder = { selection: Selection; modifiers: BuilderModifier[]; seasonLabel: string };
const BuilderContext = createContext<Builder | null>(null);

export const useModifierBuilder = () => use(BuilderContext);

/** The URL's `picks` query is the selection's single source of truth (and the share link). */
const pickListeners = new Set<() => void>();
const readPicks = () => new URLSearchParams(location.search).get(PICKS_PARAM) ?? "";
function subscribeToPicks(listener: () => void) {
	pickListeners.add(listener);
	window.addEventListener("popstate", listener);
	return () => {
		pickListeners.delete(listener);
		window.removeEventListener("popstate", listener);
	};
}
function writePicks(value: string) {
	// Built by hand so the IDs' commas stay readable (URLSearchParams would encode them as %2C).
	const others = new URLSearchParams(location.search);
	others.delete(PICKS_PARAM);
	const search = [others.toString(), value && `${PICKS_PARAM}=${value}`].filter(Boolean).join("&");
	history.replaceState(history.state, "", `${location.pathname}${search ? `?${search}` : ""}${location.hash}`);
	pickListeners.forEach((listener) => listener());
}

/**
 * Personal modifier selections for one season page. The selection lives in the URL's `picks`
 * query (read on load, replaced as it changes), so the address bar is always the share link.
 */
export function ModifierBuilderProvider({
	modifiers,
	seasonLabel,
	children,
}: {
	modifiers: BuilderModifier[];
	seasonLabel: string;
	children: ReactNode;
}) {
	const ids = useMemo(() => modifiers.map((modifier) => modifier.id), [modifiers]);
	const picks = useSyncExternalStore(subscribeToPicks, readPicks, () => "");
	const selected = useMemo(() => parsePicks(picks, ids), [picks, ids]);
	const builder = useMemo<Builder>(
		() => ({
			modifiers,
			seasonLabel,
			selection: {
				selected,
				toggle: (id) => {
					// Read the live URL, not the render snapshot, so rapid toggles never drop one.
					const next = parsePicks(readPicks(), ids);
					if (!next.delete(id)) next.add(id);
					writePicks(serializePicks(next, ids));
				},
				reset: () => writePicks(""),
			},
		}),
		[modifiers, seasonLabel, selected, ids],
	);
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
	const { selection, modifiers } = builder;
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
				"sticky top-0 z-20 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-card/95 px-4 py-2.5 text-sm shadow-lg backdrop-blur",
				// Pinned to the top edge: square top corners, thin border on the sides and bottom only.
				stuck && "rounded-t-none border-x border-b border-border",
			)}
		>
			<span className="font-semibold">Your build</span>
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
		</div>
	);
}
