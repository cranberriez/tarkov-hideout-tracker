"use client";

import Image from "next/image";
import { Minus, Plus, X } from "lucide-react";
import type { PendingItem } from "@/lib/stores/useUIStore";
import { cn } from "@/lib/utils";
import { hasQuickAddCount } from "./quick-add-model";

type CountKey = "fir" | "nonFir";

export function QuickAddItemRow({
	pending,
	onCountChange,
	onRemove,
	onDone,
	firInputRef,
}: {
	pending: PendingItem;
	onCountChange: (key: CountKey, value: number) => void;
	onRemove: () => void;
	/** Enter in a count input hands focus back to the search. */
	onDone: () => void;
	firInputRef: (element: HTMLInputElement | null) => void;
}) {
	const isEmpty = !hasQuickAddCount(pending);
	return (
		<div
			className={cn(
				"flex flex-col items-center gap-3 rounded-md border border-border-color bg-secondary/20 p-3 transition-opacity sm:flex-row",
				isEmpty && "opacity-60",
			)}
		>
			<div className="flex w-full flex-1 items-center gap-3 sm:w-auto">
				<div className="relative h-10 w-10 min-w-10 overflow-hidden rounded border border-highlight/5 bg-shadow/40">
					{pending.item.iconLink && <Image src={pending.item.iconLink} alt="" fill className="object-contain" />}
				</div>
				<div className="min-w-0">
					<div className="truncate text-sm font-medium" title={pending.item.name}>
						{pending.item.name}
					</div>
					{isEmpty && <div className="text-[11px] text-muted-foreground">Won’t be added</div>}
				</div>
			</div>

			<div className="flex w-full items-center justify-end gap-3 sm:w-auto">
				<CountField
					label="FiR"
					labelClassName="font-bold text-fir"
					value={pending.fir}
					onChange={(value) => onCountChange("fir", value)}
					onDone={onDone}
					inputRef={firInputRef}
				/>
				<CountField
					label="Non-FiR"
					labelClassName="text-muted-foreground"
					value={pending.nonFir}
					onChange={(value) => onCountChange("nonFir", value)}
					onDone={onDone}
				/>
				<button
					type="button"
					aria-label={`Remove ${pending.item.name}`}
					tabIndex={-1}
					onClick={onRemove}
					className="mt-4 cursor-pointer p-1.5 text-danger/70 transition-colors hover:text-danger"
				>
					<X size={20} />
				</button>
			</div>
		</div>
	);
}

function CountField({
	label,
	labelClassName,
	value,
	onChange,
	onDone,
	inputRef,
}: {
	label: string;
	labelClassName: string;
	value: number;
	onChange: (value: number) => void;
	onDone: () => void;
	inputRef?: (element: HTMLInputElement | null) => void;
}) {
	const stepperClass =
		"flex h-8 w-7 items-center justify-center text-muted-foreground hover:bg-highlight/5 hover:text-foreground disabled:opacity-30";
	return (
		<div className="flex flex-col items-center gap-1">
			<span className={cn("text-[10px] tracking-wider uppercase", labelClassName)}>{label}</span>
			<div className="flex items-center overflow-hidden rounded border border-highlight/10 bg-shadow/40 focus-within:border-brand/50">
				{/* Steppers are for pointer/touch; keyboard users get ↑/↓ on the input. */}
				<button
					type="button"
					tabIndex={-1}
					aria-label={`Decrease ${label}`}
					disabled={value <= 0}
					onClick={() => onChange(Math.max(0, value - 1))}
					className={stepperClass}
				>
					<Minus size={12} />
				</button>
				<input
					ref={inputRef}
					type="number"
					min="0"
					inputMode="numeric"
					aria-label={label}
					value={value || ""}
					placeholder="0"
					onChange={(event) => onChange(Math.max(0, parseInt(event.target.value) || 0))}
					onFocus={(event) => event.currentTarget.select()}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !event.ctrlKey && !event.metaKey) {
							event.preventDefault();
							onDone();
						}
					}}
					className="h-8 w-10 [appearance:textfield] bg-transparent text-center text-sm focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
				/>
				<button
					type="button"
					tabIndex={-1}
					aria-label={`Increase ${label}`}
					onClick={() => onChange(value + 1)}
					className={stepperClass}
				>
					<Plus size={12} />
				</button>
			</div>
		</div>
	);
}
