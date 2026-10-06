"use client";
import type { ReactNode } from "react";
import { RotateCcw } from "lucide-react";

export function StationCraftPriceField({
	label,
	source,
	large = false,
	value,
	estimate,
	onChange,
}: {
	label: string;
	source: ReactNode;
	large?: boolean;
	value?: number;
	estimate: number | null;
	onChange: (value: number | undefined) => void;
}) {
	return (
		<span className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded bg-background px-2 py-1.5">
			<span className="text-[11px] text-muted-foreground">{source}</span>
			<input
				aria-label={label}
				type="number"
				min="0"
				step="any"
				inputMode="decimal"
				value={value ?? ""}
				placeholder={estimate === null ? "Unknown" : String(Math.round(estimate))}
				onChange={(event) => {
					const raw = event.target.value;
					const parsed = Number(raw);
					if (!raw || (Number.isFinite(parsed) && parsed >= 0)) onChange(raw ? parsed : undefined);
				}}
				className={`min-w-0 bg-transparent text-right font-mono placeholder:text-foreground ${large ? "w-24 text-base" : "w-20 text-xs"} ${value === undefined ? "text-foreground" : "text-info"}`}
			/>
			<span className="text-[11px] text-muted-foreground">₽</span>
			{value !== undefined && (
				<button
					type="button"
					aria-label={`Reset ${label}`}
					title="Use estimate"
					onClick={() => onChange(undefined)}
					className="rounded p-1 text-muted-foreground hover:text-foreground"
				>
					<RotateCcw size={12} aria-hidden="true" />
				</button>
			)}
		</span>
	);
}
