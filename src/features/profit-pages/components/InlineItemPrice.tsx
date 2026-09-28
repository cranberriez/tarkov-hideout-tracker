"use client";

import { useProfitPricingContext } from "./ProfitPricingContext";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { getItemBuyPrice, getItemSellComparison, type ManualPriceOverride } from "@/lib/price-calculation";
import type { ItemSummary } from "@/types/items";
import type { PriceChangeHandler, RouteMethod } from "../types";
import { formatCompactPrice } from "../utils/formatters";
import { InfoHint } from "./InfoHint";

export function InlineItemPrice({
	item,
	kind,
	totalPrice,
	displayPrice,
	overrides,
	onPriceChange,
	editable = true,
	onWarningShow,
	sellValueIsEstimate,
	buyMethod,
}: {
	item?: ItemSummary;
	kind: "buy" | "sell";
	totalPrice: number | null;
	displayPrice?: number | null;
	overrides: Record<string, ManualPriceOverride>;
	onPriceChange: PriceChangeHandler;
	editable?: boolean;
	onWarningShow?: () => void;
	sellValueIsEstimate?: boolean;
	buyMethod?: RouteMethod;
}) {
	const pricingContext = useProfitPricingContext();
	const [editing, setEditing] = useState(false);
	if (!item) return <span>-</span>;
	const itemId = item.id;
	const currentUnitPrice =
		kind === "buy"
			? getItemBuyPrice(item, overrides, pricingContext)
			: getItemSellComparison(item, overrides, pricingContext).selectedPrice;
	const currentOverride = overrides[itemId] ?? {};
	const manualPrice = currentOverride[kind];
	const hasManualPrice = typeof manualPrice === "number" && Number.isFinite(manualPrice) && manualPrice >= 0;
	const manualBuy = currentOverride.buy;
	const hasManualBuy = typeof manualBuy === "number" && Number.isFinite(manualBuy) && manualBuy >= 0;
	const warning =
		kind === "sell"
			? (sellValueIsEstimate ?? getItemSellComparison(item, overrides, pricingContext).isEstimate)
			: buyMethod === "flea" &&
				!hasManualBuy &&
				currentUnitPrice !== null &&
				totalPrice !== null &&
				item.normalizedName !== "roubles" &&
				item.marketPrice?.fleaStability === "unstable";
	const usesSellValue = kind === "buy" && buyMethod === "sell" && totalPrice !== null;
	const color = hasManualPrice ? "text-info" : warning ? "text-warning" : "text-brand";
	const formattedPrice = formatCompactPrice(displayPrice === undefined ? totalPrice : displayPrice);
	function commit(raw: string) {
		const parsed = raw.trim() === "" ? undefined : Number(raw);
		onPriceChange(itemId, {
			...currentOverride,
			...(kind === "sell"
				? {
						sellSource:
							currentOverride.sellSource ??
							getItemSellComparison(item, overrides, pricingContext).saleDestination ??
							"flea",
					}
				: {}),
			[kind]: parsed !== undefined && Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined,
		});
		setEditing(false);
	}
	function resetManualPrice() {
		onPriceChange(itemId, {
			...currentOverride,
			[kind]: undefined,
			...(kind === "sell" ? { sellSource: undefined } : {}),
		});
	}
	if (editing)
		return (
			<input
				autoFocus
				type="number"
				min="0"
				placeholder={currentUnitPrice === null ? "No price" : String(Math.round(currentUnitPrice))}
				defaultValue={currentOverride[kind]}
				onClick={(event) => event.stopPropagation()}
				onKeyDown={(event) => {
					event.stopPropagation();
					if (event.key === "Enter") commit(event.currentTarget.value);
					if (event.key === "Escape") setEditing(false);
				}}
				onBlur={(event) => commit(event.currentTarget.value)}
				className={`h-5 w-16 rounded border border-brand/50 bg-shadow px-1 text-xs outline-none ${hasManualPrice ? "text-info" : "text-foreground"}`}
			/>
		);
	return (
		<span className="inline-flex items-center gap-1">
			{editable ? (
				<button
					type="button"
					title={`Edit ${kind} price`}
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						setEditing(true);
					}}
					className={`cursor-pointer truncate ${color} ${hasManualPrice ? "underline decoration-dashed underline-offset-2" : "hover:underline"}`}
				>
					{formattedPrice}
				</button>
			) : (
				<span className={`truncate ${color} ${hasManualPrice ? "underline decoration-dashed underline-offset-2" : ""}`}>
					{formattedPrice}
				</span>
			)}
			{hasManualPrice && (
				<button
					type="button"
					aria-label={`Reset ${kind} price for ${item.name}`}
					title="Reset to normal price"
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						resetManualPrice();
					}}
					className="inline-flex size-4 cursor-pointer items-center justify-center rounded-full text-info hover:bg-info/10 focus-visible:outline-2 focus-visible:outline-info"
				>
					<RotateCcw className="size-3" aria-hidden="true" />
				</button>
			)}
			{warning &&
				(kind === "buy" ? (
					<span className="whitespace-nowrap text-[11px] font-normal text-warning">(value unstable)</span>
				) : (
					<InfoHint title="Value unstable" tone="warning" compact onShow={onWarningShow} />
				))}
			{usesSellValue && (
				<span className="whitespace-nowrap text-[11px] font-normal text-muted-foreground">(sell value)</span>
			)}
		</span>
	);
}
