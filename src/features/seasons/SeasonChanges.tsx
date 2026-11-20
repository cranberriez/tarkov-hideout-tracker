"use client";

import { createContext, use, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Season page view options ("See changes", "Compact"): off by default, local to the page view. */
const SeasonViewContext = createContext<{
	shown: boolean;
	setShown: (shown: boolean) => void;
	compact: boolean;
	setCompact: (compact: boolean) => void;
} | null>(null);

export function SeasonChangesProvider({ children }: { children: ReactNode }) {
	const [shown, setShown] = useState(false);
	const [compact, setCompact] = useState(false);
	return <SeasonViewContext value={{ shown, setShown, compact, setCompact }}>{children}</SeasonViewContext>;
}

function ViewToggle({
	pressed,
	onChange,
	children,
}: {
	pressed: boolean;
	onChange: (pressed: boolean) => void;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			aria-pressed={pressed}
			onClick={() => onChange(!pressed)}
			className={cn(
				"inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
				pressed ? "bg-foreground text-background" : "bg-surface-raised text-foreground hover:bg-surface-raised/70",
			)}
		>
			<span
				aria-hidden
				className={cn(
					"relative h-3.5 w-6 rounded-full transition-colors",
					pressed ? "bg-background/40" : "bg-foreground/25",
				)}
			>
				<span
					className={cn(
						"absolute top-0.5 size-2.5 rounded-full bg-current transition-[left]",
						pressed ? "left-3" : "left-0.5",
					)}
				/>
			</span>
			{children}
		</button>
	);
}

/** "See changes" and "Compact" toggles; nothing outside a season view provider. */
export function SeasonViewOptions({ className }: { className?: string }) {
	const context = use(SeasonViewContext);
	if (!context) return null;
	return (
		<div role="group" aria-label="View options" className={cn("flex flex-wrap items-center gap-2", className)}>
			<span aria-hidden className="text-xs text-foreground/85">
				Options:
			</span>
			<ViewToggle pressed={context.shown} onChange={context.setShown}>
				See changes
			</ViewToggle>
			<ViewToggle pressed={context.compact} onChange={context.setCompact}>
				Compact
			</ViewToggle>
		</div>
	);
}

/**
 * Personal modifier lists. Exposes `data-compact` on the `group/season-view` wrapper so
 * server-rendered cards can restyle with Tailwind variants.
 */
export function SeasonView({ className, children }: { className?: string; children: ReactNode }) {
	const context = use(SeasonViewContext);
	return (
		<div data-compact={context?.compact || undefined} className={cn("group/season-view", className)}>
			{children}
		</div>
	);
}

/** Card footer row that exists only while "See changes" is on, so cards stay compact otherwise. */
export function ChangeRow({ children }: { children: ReactNode }) {
	const context = use(SeasonViewContext);
	if (!context?.shown) return null;
	return <div className="mt-auto flex h-7 items-center gap-1.5 overflow-hidden pt-2">{children}</div>;
}

/** Renders its chip only while "See changes" is on. */
export function ChangeChip({ className, children }: { className: string; children: ReactNode }) {
	const context = use(SeasonViewContext);
	if (!context?.shown) return null;
	return (
		<span
			className={cn(
				"rounded-full px-2 py-0.5 text-xs font-semibold normal-case tracking-normal tabular-nums",
				className,
			)}
		>
			{children}
		</span>
	);
}
