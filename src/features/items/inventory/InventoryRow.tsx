"use client";

import { useState } from "react";
import Image from "next/image";
import { HelpCircle, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { DemandReasonLine } from "../demand/DemandReasonLine";
import type { SaveReason } from "../demand/item-demand-model";
import { inventoryDisplayName, previewReasons, type InventoryRow as InventoryRowData } from "./inventory-model";
import { itemImageUrl } from "@/lib/utils/item-images";

export function InventoryRow({
	row,
	onSetCount,
	onOpenItem,
	reasons,
}: {
	row: InventoryRowData;
	onSetCount: (key: "fir" | "nonFir", value: number) => void;
	onOpenItem?: () => void;
	/** Undefined until requirements load. */
	reasons?: readonly SaveReason[];
}) {
	const name = row.item?.name ?? "Unknown item";
	const label = row.item ? inventoryDisplayName(row.item) : name;
	const isEmpty = row.fir === 0 && row.nonFir === 0;
	const image = row.item ? (
		<Image src={itemImageUrl(row.item)} alt="" fill className="object-contain" unoptimized />
	) : (
		<HelpCircle size={18} className="text-muted-foreground" aria-hidden="true" />
	);
	const imageClass =
		"relative flex size-12 shrink-0 items-center justify-center overflow-hidden border border-highlight/5 bg-shadow/40";
	const hasUses = !!row.item && !isEmpty && !!reasons;
	return (
		<li
			className={cn(
				// Below sm everything stacks; sm puts uses under the item; md+ gives uses their own column.
				"grid gap-3 rounded-md border border-border-color bg-secondary/20 p-3 transition-opacity sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center md:grid-cols-[10rem_minmax(0,1fr)_auto] lg:grid-cols-[16rem_minmax(0,1fr)_auto]",
				isEmpty && "opacity-60",
			)}
		>
			<div className="flex min-w-0 items-center gap-3 sm:col-start-1 sm:row-start-1">
				{onOpenItem ? (
					<button
						type="button"
						onClick={onOpenItem}
						aria-label={`Open ${name}`}
						title={name}
						className={cn(imageClass, "transition-colors hover:border-brand/50")}
					>
						{image}
					</button>
				) : (
					<div className={imageClass}>{image}</div>
				)}
				<div className="min-w-0">
					{onOpenItem ? (
						<button
							type="button"
							onClick={onOpenItem}
							title={name}
							className="block max-w-full truncate text-left text-sm font-medium text-foreground hover:text-brand"
						>
							{label}
						</button>
					) : (
						<div className="truncate text-sm font-medium text-foreground" title={name}>
							{label}
						</div>
					)}
					{(!row.item || isEmpty) && (
						<div className="truncate text-[11px] text-muted-foreground">
							{!row.item ? `Not in current game data · ${row.id}` : "None left · hidden next visit"}
						</div>
					)}
				</div>
			</div>

			{hasUses && (
				<div className="min-w-0 sm:col-span-2 sm:row-start-2 sm:pl-15 md:col-span-1 md:col-start-2 md:row-start-1 md:pl-0">
					<ItemUses reasons={reasons} />
				</div>
			)}

			<div className="flex items-center justify-end gap-3 sm:col-start-2 sm:row-start-1 md:col-start-3">
				<CountStepper
					label="FiR"
					labelClassName="font-bold text-fir"
					value={row.fir}
					onChange={(v) => onSetCount("fir", v)}
				/>
				<CountStepper
					label="Non-FiR"
					labelClassName="text-muted-foreground"
					value={row.nonFir}
					onChange={(v) => onSetCount("nonFir", v)}
				/>
			</div>
		</li>
	);
}

function ItemUses({ reasons }: { reasons: readonly SaveReason[] }) {
	const [expanded, setExpanded] = useState(false);
	if (!reasons.length) return <p className="text-[11px] text-muted-foreground">Not needed for hideout or quests</p>;
	const { visible, hidden } = previewReasons(reasons, expanded);
	return (
		<div className="leading-tight">
			<ul>
				{visible.map((reason) => (
					<DemandReasonLine key={`${reason.kind}:${reason.id}`} reason={reason} compact linked />
				))}
			</ul>
			{(hidden > 0 || expanded) && (
				<button
					type="button"
					aria-expanded={expanded}
					onClick={() => setExpanded(!expanded)}
					className="ml-12 text-[11px] text-muted-foreground hover:text-foreground"
				>
					{expanded ? "Show less" : `+ ${hidden} more`}
				</button>
			)}
		</div>
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
