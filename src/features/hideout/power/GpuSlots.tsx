"use client";

import { useId } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Card count editor: typed value flanked by minus and plus. */
export function GpuCountControl({
	slots,
	count,
	onChange,
}: {
	slots: number;
	count: number;
	onChange: (count: number) => void;
}) {
	const inputId = useId();
	const set = (value: number) => {
		const next = Math.min(slots, Math.max(0, Math.floor(value)));
		onChange(next);
		return next;
	};
	return (
		<div className="flex flex-col items-start gap-1">
			<label htmlFor={inputId} className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
				Graphics cards
			</label>
			<div className="flex items-center gap-1">
				<Button
					variant="ghost"
					size="md"
					iconOnly
					className="size-10"
					aria-label="Remove a graphics card"
					disabled={count <= 0}
					onClick={() => set(count - 1)}
				>
					<Minus size={20} />
				</Button>
				<div className="flex items-baseline gap-1">
					<input
						key={`${count}:${slots}`}
						id={inputId}
						type="text"
						inputMode="numeric"
						aria-label="Installed graphics cards"
						defaultValue={count}
						onFocus={(event) => event.currentTarget.select()}
						onBlur={(event) => {
							const value = event.currentTarget.value.trim();
							const parsed = Number(value);
							event.currentTarget.value = String(value !== "" && Number.isFinite(parsed) ? set(parsed) : count);
						}}
						onKeyDown={(event) => {
							if (event.key === "Escape") event.currentTarget.value = String(count);
							if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur();
						}}
						className="h-10 w-[2.6ch] rounded-sm border-0 bg-transparent p-0 text-center font-mono text-2xl font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-brand"
					/>
					<span className="text-xs tabular-nums text-muted-foreground">/ {slots}</span>
				</div>
				<Button
					variant="ghost"
					size="md"
					iconOnly
					className="size-10"
					aria-label="Add a graphics card"
					disabled={count >= slots}
					onClick={() => set(count + 1)}
				>
					<Plus size={20} />
				</Button>
			</div>
		</div>
	);
}

const SLOT_ROWS = 5;
const SLOT_WIDTH = 16;
/** Widest a column may claim before the grid stops spreading, so few columns stay close together. */
const COLUMN_MAX_SPACING = 44;

/**
 * Read-only slot overview: columns of five slots filled top to bottom, a white bar per
 * installed card and a dashed outline per empty slot. Higher farm levels add columns; the
 * columns spread to fill the available width up to a per-column limit.
 */
export function GpuSlotColumns({ slots, count }: { slots: number; count: number }) {
	const columns = Math.ceil(slots / SLOT_ROWS);
	return (
		<div
			role="img"
			aria-label={`${count} of ${slots} graphics card slots installed`}
			className="grid min-w-24 flex-1 grid-flow-col content-center justify-between gap-y-[3px]"
			style={{
				maxWidth: columns * COLUMN_MAX_SPACING,
				gridTemplateRows: `repeat(${SLOT_ROWS}, 7px)`,
				gridTemplateColumns: `repeat(${columns}, ${SLOT_WIDTH}px)`,
			}}
		>
			{Array.from({ length: slots }, (_, index) => (
				<span
					key={index}
					aria-hidden
					className={cn("rounded-[1px]", index < count ? "bg-highlight" : "border border-dashed border-highlight/40")}
				/>
			))}
		</div>
	);
}
