"use client";

import { createContext, use, useMemo, useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { builderTotals } from "./modifiers/builder";
import { formatPoints } from "./modifiers/types";

type Selection = { selected: ReadonlySet<string>; toggle: (id: string) => void; reset: () => void };
const SelectionContext = createContext<Selection | null>(null);
const PointsContext = createContext<Record<string, number>>({});

/** Personal modifier selections for one season page. Local state for now; share URLs come later. */
export function ModifierBuilderProvider({ points, children }: { points: Record<string, number>; children: ReactNode }) {
	const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
	const selection = useMemo<Selection>(
		() => ({
			selected,
			toggle: (id) =>
				setSelected((current) => {
					const next = new Set(current);
					if (!next.delete(id)) next.add(id);
					return next;
				}),
			reset: () => setSelected(new Set()),
		}),
		[selected],
	);
	return (
		<PointsContext value={points}>
			<SelectionContext value={selection}>{children}</SelectionContext>
		</PointsContext>
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
	const selection = use(SelectionContext);
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
				{/* Sized and inset to sit inside the card's rounded corner. */}
				{/* SVG keeps the ring even when the card lands on a sub-pixel (fractional grid columns). */}
				<svg
					aria-hidden
					viewBox="0 0 14 14"
					className={cn(
						"absolute left-1 top-1 size-3.5",
						checked ? (kind === "positive" ? "text-success" : "text-danger") : "text-foreground/50",
					)}
				>
					<circle
						cx="7"
						cy="7"
						r={checked ? 7 : 6}
						fill={checked ? "currentColor" : "none"}
						stroke={checked ? "none" : "currentColor"}
						strokeWidth="2"
					/>
					{checked && (
						<path
							d="M4 7.2 6.1 9.2 10 5"
							fill="none"
							stroke="var(--background)"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					)}
				</svg>
				{children}
			</button>
		</li>
	);
}

/** Point totals for the current selection; sticks near the top while scrolling the personal lists. */
export function ModifierBuilderBar() {
	const selection = use(SelectionContext);
	const points = use(PointsContext);
	if (!selection) return null;
	const totals = builderTotals(selection.selected, points);
	return (
		<div
			role="status"
			aria-live="polite"
			className="sticky top-2 z-20 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-card/95 px-4 py-2.5 text-sm shadow-lg backdrop-blur"
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
		</div>
	);
}
