"use client";

import Image from "next/image";
import { HelpCircle, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils/format-number";
import type { InventoryRow as InventoryRowData } from "./inventory-model";

export function InventoryRow({
	row,
	onSetCount,
	onOpenItem,
}: {
	row: InventoryRowData;
	onSetCount: (key: "fir" | "nonFir", value: number) => void;
	onOpenItem?: () => void;
}) {
	const name = row.item?.name ?? "Unknown item";
	const total = row.fir + row.nonFir;
	const isEmpty = row.fir === 0 && row.nonFir === 0;
	return (
		<li
			className={cn(
				"flex flex-col gap-3 rounded-md border border-border-color bg-secondary/20 p-3 transition-opacity sm:flex-row sm:items-center",
				isEmpty && "opacity-60",
			)}
		>
			<div className="flex min-w-0 flex-1 items-center gap-3">
				<div className="relative flex h-10 w-10 min-w-10 items-center justify-center overflow-hidden rounded border border-highlight/5 bg-shadow/40">
					{row.item?.iconLink ? (
						<Image src={row.item.iconLink} alt="" fill className="object-contain" />
					) : (
						!row.item && <HelpCircle size={18} className="text-muted-foreground" aria-hidden="true" />
					)}
				</div>
				<div className="min-w-0">
					{onOpenItem ? (
						<button
							type="button"
							onClick={onOpenItem}
							title={name}
							className="block max-w-full truncate text-left text-sm font-medium text-foreground hover:text-brand"
						>
							{name}
						</button>
					) : (
						<div className="truncate text-sm font-medium text-foreground" title={name}>
							{name}
						</div>
					)}
					<div className="truncate text-[11px] text-muted-foreground">
						{!row.item
							? `Not in current game data · ${row.id}`
							: isEmpty
								? "None left · hidden next visit"
								: row.item.shortName}
					</div>
				</div>
			</div>

			<div className="flex items-center justify-end gap-3">
				<CountStepper
					label="FiR"
					labelClassName="font-bold text-warning"
					value={row.fir}
					onChange={(v) => onSetCount("fir", v)}
				/>
				<CountStepper
					label="Non-FiR"
					labelClassName="text-muted-foreground"
					value={row.nonFir}
					onChange={(v) => onSetCount("nonFir", v)}
				/>
				<div className="flex w-14 flex-col items-end gap-1">
					<span className="text-[10px] tracking-wider text-muted-foreground uppercase">Total</span>
					<span className={cn("h-8 font-mono text-sm leading-8 font-semibold", total < 0 && "text-danger")}>
						{formatNumber(total)}
					</span>
				</div>
			</div>
		</li>
	);
}

function CountStepper({
	label,
	labelClassName,
	value,
	onChange,
}: {
	label: string;
	labelClassName: string;
	value: number;
	onChange: (value: number) => void;
}) {
	const isNegative = value < 0;
	const stepperClass =
		"flex h-8 w-7 items-center justify-center text-muted-foreground hover:bg-highlight/5 hover:text-foreground disabled:opacity-30";
	return (
		<div className="flex flex-col items-center gap-1">
			<span className={cn("text-[10px] tracking-wider uppercase", labelClassName)}>{label}</span>
			<div
				className={cn(
					"flex items-center overflow-hidden rounded border bg-shadow/40 focus-within:border-brand/50",
					isNegative ? "border-danger/60" : "border-highlight/10",
				)}
				title={isNegative ? "Negative balance: items were consumed that were never logged" : undefined}
			>
				{/* Steppers never create a negative balance; + moves an existing one back toward zero. */}
				<button
					type="button"
					aria-label={`Remove one ${label}`}
					disabled={value <= 0}
					onClick={() => onChange(value - 1)}
					className={stepperClass}
				>
					<Minus size={12} />
				</button>
				<input
					type="number"
					min="0"
					inputMode="numeric"
					aria-label={`${label} count`}
					aria-invalid={isNegative || undefined}
					value={value}
					onChange={(event) => onChange(Math.max(0, parseInt(event.target.value) || 0))}
					onFocus={(event) => event.currentTarget.select()}
					className={cn(
						"h-8 w-12 [appearance:textfield] bg-transparent text-center font-mono text-sm focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
						isNegative && "text-danger",
					)}
				/>
				<button
					type="button"
					aria-label={`Add one ${label}`}
					onClick={() => onChange(value + 1)}
					className={stepperClass}
				>
					<Plus size={12} />
				</button>
			</div>
		</div>
	);
}
