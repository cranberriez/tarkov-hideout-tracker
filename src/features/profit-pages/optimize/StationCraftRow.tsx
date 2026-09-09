"use client";
import type { ReactNode } from "react";
import { Pin, SlidersHorizontal } from "lucide-react";
import type { RecipeCalculatorInput, RecipeEvaluation } from "@/lib/price-calculation";
import { formatDuration, formatQuantity, formatRoundedRoubles, formatSignedRoubles } from "../utils/formatters";
import { CraftImage } from "./CraftImage";
import { boardCraftAvailable } from "./station-board";

export function StationCraftRow({
	row,
	itemsById,
	pinned,
	open,
	placement,
	onItemOpen,
	onTogglePinned,
	onToggleDetails,
	children,
}: {
	row: RecipeEvaluation;
	itemsById: RecipeCalculatorInput["itemsById"];
	pinned: boolean;
	open: boolean;
	placement?: number;
	onItemOpen: (id: string) => void;
	onTogglePinned: () => void;
	onToggleDetails: () => void;
	children?: ReactNode;
}) {
	const output = itemsById[row.outputItemId];
	const available = boardCraftAvailable(row);
	const gross = row.grossSellValue === undefined ? row.sellValue : row.grossSellValue;
	const roi = row.cost && row.profit !== null ? (row.profit / row.cost) * 100 : null;
	return (
		<div className={`bg-highlight/2.5 ${pinned ? "bg-highlight/5" : ""} rounded`}>
			<div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-2 py-2.5 lg:grid-cols-[minmax(170px,1.15fr)_82px_minmax(200px,2fr)_108px_124px_78px]">
				<button type="button" onClick={() => onItemOpen(row.outputItemId)} className="flex min-w-0 items-center gap-2 text-left hover:text-brand">
					<CraftImage item={output} size={36} />
					<span className="min-w-0 text-xs font-medium">
						{output?.name ?? row.outputItemId}
						<span className="ml-1 text-muted-foreground">×{formatQuantity(row.outputCount)}</span>
					</span>
				</button>
				<span className="text-xs text-muted-foreground lg:block">{formatDuration(row.durationSeconds)}</span>
				<div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 lg:col-span-1">
					{row.requiredItems.map((part) => (
						<button
							key={`${part.itemId}:${part.isTool}`}
							type="button"
							title={`${itemsById[part.itemId]?.name ?? part.itemId}${part.isTool ? " · reusable tool" : ""}`}
							onClick={() => onItemOpen(part.itemId)}
							className={`inline-flex items-center gap-1 text-xs hover:text-foreground ${part.isTool ? "text-muted-foreground/70" : "text-muted-foreground"}`}
						>
							<CraftImage item={itemsById[part.itemId]} size={22} />
							<span>
								{formatQuantity(part.quantity)}× {itemsById[part.itemId]?.shortName ?? itemsById[part.itemId]?.name ?? part.itemId}
								{part.isTool ? " · tool" : ""}
							</span>
						</button>
					))}
				</div>
				<div className="text-xs">
					<span className="block font-mono">{formatRoundedRoubles(gross === null ? null : gross / row.outputCount)}</span>
					<span className="text-[11px] text-muted-foreground">each · {row.sellSourceLabel ?? "No sale price"}</span>
				</div>
				<div
					className="relative pr-9 text-right text-xs lg:text-left"
					title={`Inputs: ${formatRoundedRoubles(row.cost)} · Listing fee: ${formatRoundedRoubles(row.sellFee ?? null)} · Proceeds: ${formatRoundedRoubles(row.sellValue)}${roi === null ? "" : ` · Return on inputs: ${roi.toFixed(1)}%`}`}
				>
					<span className={`block font-mono font-medium ${!available ? "text-warning" : (row.profit ?? 0) > 0 ? "text-success" : "text-danger"}`}>
						{!available ? "Check details" : formatSignedRoubles(row.profit)}
					</span>
					<span className="text-[11px] text-muted-foreground">{available ? `${formatSignedRoubles(row.profitPerHour)} / h` : "Saved craft retained"}</span>
					{placement && (
						<span
							title={`${placement === 1 ? "Gold" : placement === 2 ? "Silver" : "Bronze"} craft for this station`}
							className={`absolute right-0 top-1/2 -translate-y-1/2 rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
								placement === 1
									? "border-warning/40 bg-warning/10 text-warning"
									: placement === 2
										? "border-border/40 bg-muted/10 text-foreground"
										: "border-warning/40 bg-warning/10 text-warning"
							}`}
						>
							#{placement}
						</span>
					)}
				</div>
				<div className="col-span-2 flex justify-end gap-1 lg:col-span-1">
					<button
						type="button"
						aria-label={`${pinned ? "Unpin" : "Pin"} ${output?.name ?? row.id}`}
						aria-pressed={pinned}
						title={pinned ? "Remove from board" : "Keep on board"}
						onClick={() => onTogglePinned()}
						className={`rounded p-2 hover:bg-highlight/10 ${pinned ? "text-info" : "text-muted-foreground"}`}
					>
						<Pin size={15} className={pinned ? "fill-current" : ""} />
					</button>
					<button
						type="button"
						aria-label={`Details for ${output?.name ?? row.id}`}
						aria-expanded={open}
						title="Prices and routes"
						onClick={() => onToggleDetails()}
						className={`rounded p-2 hover:bg-highlight/10 ${open ? "text-foreground bg-highlight/10" : "text-muted-foreground"}`}
					>
						<SlidersHorizontal size={15} />
					</button>
				</div>
			</div>
			{children}
		</div>
	);
}
