"use client";

import { createContext, use, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** "See changes" toggle for season pages: off by default, local to the page view. */
const SeasonChangesContext = createContext<{ shown: boolean; setShown: (shown: boolean) => void } | null>(null);

export function SeasonChangesProvider({ children }: { children: ReactNode }) {
	const [shown, setShown] = useState(false);
	return <SeasonChangesContext value={{ shown, setShown }}>{children}</SeasonChangesContext>;
}

export function SeasonChangesToggle({ className }: { className?: string }) {
	const context = use(SeasonChangesContext);
	if (!context) return null;
	const { shown, setShown } = context;
	return (
		<button
			type="button"
			aria-pressed={shown}
			onClick={() => setShown(!shown)}
			className={cn(
				"inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
				shown ? "bg-untar text-untar-surface" : "bg-untar-ink/10 text-untar-ink hover:bg-untar-ink/15",
				className,
			)}
		>
			<span
				aria-hidden
				className={cn(
					"relative h-3.5 w-6 rounded-full transition-colors",
					shown ? "bg-untar-surface/40" : "bg-untar-ink/25",
				)}
			>
				<span
					className={cn(
						"absolute top-0.5 size-2.5 rounded-full bg-current transition-[left]",
						shown ? "left-3" : "left-0.5",
					)}
				/>
			</span>
			See changes
		</button>
	);
}

/** Card footer row that exists only while "See changes" is on, so cards stay compact otherwise. */
export function ChangeRow({ children }: { children: ReactNode }) {
	const context = use(SeasonChangesContext);
	if (!context?.shown) return null;
	return <div className="mt-auto flex h-7 items-center gap-1.5 overflow-hidden pt-2">{children}</div>;
}

/** Renders its chip only while "See changes" is on. */
export function ChangeChip({ className, children }: { className: string; children: ReactNode }) {
	const context = use(SeasonChangesContext);
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
