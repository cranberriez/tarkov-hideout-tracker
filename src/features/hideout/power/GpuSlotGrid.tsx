"use client";

import { useId, useState, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** All 50 slots stay visible; the saved station level determines which can be used. */
export function GpuSlotGrid({
	slots,
	count,
	onChange,
	children,
}: {
	slots: number;
	count: number;
	onChange: (count: number) => void;
	children?: ReactNode;
}) {
	const inputId = useId();
	const [preview, setPreview] = useState<number | null>(null);
	const set = (value: number) => {
		const next = Math.min(slots, Math.max(0, Math.floor(value)));
		setPreview(null);
		onChange(next);
		return next;
	};
	return (
		<div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-4 rounded-lg bg-shadow/20 p-4">
			<div className="flex min-w-0 flex-col items-start gap-2 sm:max-w-72">
				<label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
					Graphics cards
				</label>
				<div className="flex items-center divide-x divide-highlight/10 rounded-sm border border-highlight/15 bg-shadow/20">
					<div className="flex h-8 items-center pr-3">
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
							className="h-8 w-11 rounded-sm border-0 bg-transparent text-center font-mono text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-brand"
						/>
						<span className="text-xs tabular-nums text-muted-foreground">/ {slots}</span>
					</div>
					<Button
						variant="ghost"
						size="sm"
						iconOnly
						className="rounded-none"
						aria-label="Remove a graphics card"
						disabled={count <= 0}
						onClick={() => set(count - 1)}
					>
						<Minus size={14} />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						iconOnly
						className="rounded-none"
						aria-label="Add a graphics card"
						disabled={count >= slots}
						onClick={() => set(count + 1)}
					>
						<Plus size={14} />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="rounded-none"
						aria-label="Fill graphics cards to maximum"
						disabled={count >= slots}
						onClick={() => set(slots)}
					>
						Max
					</Button>
					<Button variant="ghost" size="sm" className="rounded-l-none" disabled={count <= 0} onClick={() => set(0)}>
						Clear
					</Button>
				</div>
				{children}
			</div>
			<div
				role="group"
				aria-label={`Graphics card slots, ${count} of ${slots} installed`}
				onPointerLeave={() => setPreview(null)}
				className="grid w-full max-w-64 grid-cols-10 gap-1"
			>
				{Array.from({ length: 50 }, (_, index) => {
					const slot = index + 1;
					const available = slot <= slots;
					const filled = slot <= count;
					const next = filled ? slot - 1 : slot;
					const adding = available && preview !== null && slot > count && slot <= preview;
					const removing = filled && preview !== null && slot > preview;
					return (
						<button
							key={slot}
							type="button"
							disabled={!available}
							aria-label={
								!available
									? `Graphics card slot ${slot}, locked`
									: filled
										? slot === count
											? `Remove graphics card ${slot}`
											: `Remove graphics cards ${slot} through ${count}`
										: `Install ${slot} graphics cards`
							}
							aria-pressed={slot <= count}
							onPointerEnter={(event) => {
								if (event.pointerType !== "touch") setPreview(available ? next : null);
							}}
							onFocus={() => setPreview(next)}
							onBlur={() => setPreview(null)}
							onClick={() => set(next)}
							className={cn(
								"flex h-4 items-center justify-center gap-0.5 rounded-[3px] border transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
								!available
									? "border-highlight/5 bg-highlight/3"
									: removing
										? "cursor-pointer border-dashed border-danger/80 bg-danger/10 text-danger/70"
										: adding
											? "cursor-pointer border-dashed border-brand/80 bg-brand/5"
											: filled
												? "cursor-pointer border-brand/35 bg-brand/20 text-brand/80"
												: "cursor-pointer border-dashed border-highlight/30 bg-highlight/5",
							)}
						>
							{filled && available && (
								<span aria-hidden className="flex gap-0.5">
									<span className="size-1 rounded-[1px] bg-current/70" />
									<span className="size-1 rounded-[1px] bg-current/70" />
									<span className="size-1 rounded-[1px] bg-current/70" />
								</span>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}
