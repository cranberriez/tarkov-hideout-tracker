"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterNumberInput } from "@/components/ui/FilterNumberInput";
import { cn } from "@/lib/utils";

/**
 * One cell per graphics-card slot at the saved level, filled in order. Clicking cell N
 * installs N cards (clicking the last filled cell removes it).
 */
export function GpuSlotGrid({
	slots,
	count,
	onChange,
}: {
	slots: number;
	count: number;
	onChange: (count: number) => void;
}) {
	const set = (value: number) => onChange(Math.min(slots, Math.max(0, value)));
	return (
		<div className="flex flex-col gap-3">
			<div
				role="group"
				aria-label={`Graphics card slots, ${count} of ${slots} installed`}
				className="grid grid-cols-10 gap-1 sm:max-w-md"
			>
				{Array.from({ length: slots }, (_, index) => {
					const slot = index + 1;
					const filled = slot <= count;
					return (
						<button
							key={slot}
							type="button"
							aria-label={filled && slot === count ? `Remove graphics card ${slot}` : `Install ${slot} graphics cards`}
							aria-pressed={filled}
							onClick={() => set(filled && slot === count ? slot - 1 : slot)}
							className={cn(
								"h-4 rounded-[2px] border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
								filled
									? "border-brand bg-brand/80 hover:bg-brand"
									: "border-highlight/12 bg-shadow/30 hover:border-brand/60",
							)}
						/>
					);
				})}
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Button size="xs" iconOnly aria-label="Remove a graphics card" disabled={count <= 0} onClick={() => set(count - 1)}>
					<Minus size={12} />
				</Button>
				<FilterNumberInput
					label="Installed graphics cards"
					value={count}
					onCommit={set}
					widthClassName="w-8"
					suffix={<span>/ {slots} GPUs</span>}
				/>
				<Button size="xs" iconOnly aria-label="Add a graphics card" disabled={count >= slots} onClick={() => set(count + 1)}>
					<Plus size={12} />
				</Button>
				<Button size="xs" disabled={count >= slots} onClick={() => set(slots)}>
					Fill to max
				</Button>
				<Button size="xs" variant="ghost" disabled={count <= 0} onClick={() => set(0)}>
					Clear
				</Button>
			</div>
		</div>
	);
}
