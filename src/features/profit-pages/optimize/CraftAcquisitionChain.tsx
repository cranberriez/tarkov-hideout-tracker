"use client";

import { useState } from "react";
import { ArrowLeft, ArrowUpRight, ArrowLeftRight, ShoppingBasket, Wrench } from "lucide-react";
import type { AcquisitionPlan } from "@/lib/price-calculation/types";
import type { ItemSummary } from "@/types/items";
import type { ProfitStationSource } from "../types";
import { formatQuantity, formatRoundedRoubles } from "../utils/formatters";
import type { CraftPlan } from "./craft-plans";
import { CraftImage } from "./CraftImage";

export function CraftAcquisitionChain({
	plan,
	items,
	stations,
	traders,
}: {
	plan: CraftPlan;
	items: Readonly<Record<string, ItemSummary>>;
	stations: Record<string, ProfitStationSource>;
	traders: Record<string, { name: string }>;
}) {
	const [history, setHistory] = useState<{ part: AcquisitionPlan; path: string }[]>([]);
	const focus = history.at(-1);
	const focusName = focus ? (items[focus.part.itemId]?.name ?? focus.part.itemId) : plan.name;
	const focusStation = focus && plan.steps.find((step) => step.recipeId === focus.part.sourceId)?.stationId;
	const focusTrader = focus && plan.exchanges?.find((exchange) => exchange.id === focus.path)?.traderId;
	const focusSource =
		focus?.part.method === "craft"
			? `Craft · ${focusStation ? (stations[focusStation]?.name ?? focusStation) : "Unknown station"}`
			: `Barter · ${focusTrader ? (traders[focusTrader]?.name ?? focusTrader) : "Unknown trader"}`;
	// Keep original indices: exchange IDs refer to the acquisition tree's source order.
	function orderedInputs(parts: AcquisitionPlan[]) {
		return parts.map((part, index) => ({ part, index })).sort((a, b) => Number(!!a.part.isTool) - Number(!!b.part.isTool));
	}
	function renderInput(part: AcquisitionPlan, path: string, depth: number) {
		const stationId = plan.steps.find((step) => step.recipeId === part.sourceId)?.stationId;
		const traderId = part.traderOffer?.traderId ?? plan.exchanges?.find((exchange) => exchange.id === path)?.traderId;
		const label = part.isTool
			? "Owned tool"
			: part.method === "craft"
				? `Craft · ${stationId ? (stations[stationId]?.name ?? stationId) : "Unknown station"}`
				: part.method === "barter"
					? `Barter · ${traderId ? (traders[traderId]?.name ?? traderId) : "Unknown trader"}`
					: part.method === "trader"
						? `Buy · ${traderId ? (traders[traderId]?.name ?? traderId) : "Unknown trader"}`
						: "Buy · Flea market";
		const MethodIcon = part.isTool || part.method === "craft" ? Wrench : part.method === "barter" ? ArrowLeftRight : ShoppingBasket;
		const color = part.isTool
			? "text-muted-foreground"
			: part.method === "craft"
				? "text-orange-300/80"
				: part.method === "barter"
					? "text-sky-300/80"
					: "text-emerald-300/80";
		return (
			<li key={path} className="relative pt-2 before:absolute before:-left-3 before:top-8 before:w-3 before:border-t before:border-white/15">
				<div className={`flex items-center gap-3 px-2 py-2 ${part.isTool ? "opacity-60" : ""}`}>
					<CraftImage item={items[part.itemId]} size={36} className="rounded bg-black/20 p-0.5" />
					<div className="min-w-0 flex-1">
						{!part.isTool && (part.method === "craft" || part.method === "barter") ? (
							<button
								type="button"
								onClick={() => setHistory((previous) => [...previous, { part, path }])}
								className="flex items-center gap-1 text-left text-xs font-medium leading-relaxed hover:text-tarkov-green"
								aria-label={`View acquisition chain for ${items[part.itemId]?.name ?? part.itemId}`}
							>
								{items[part.itemId]?.name ?? part.itemId}
								<ArrowUpRight size={12} className="shrink-0" />
							</button>
						) : (
							<p className="break-words text-xs font-medium leading-relaxed">{items[part.itemId]?.name ?? part.itemId}</p>
						)}
						<span className={`mt-0.5 flex items-center gap-1.5 text-[11px] ${color}`}>
							<MethodIcon size={11} className="shrink-0" aria-hidden="true" />
							{label}
						</span>
						{!part.isTool && (
							<p className="mt-1 text-[11px] text-muted-foreground">
								<span className="font-mono">{formatRoundedRoubles(part.totalCost !== null && part.quantity > 0 ? part.totalCost / part.quantity : null)}</span>{" "}
								each
								{part.quantity !== 1 && (
									<>
										{" "}
										· <span className="font-mono">{formatRoundedRoubles(part.totalCost)}</span> total
									</>
								)}
							</p>
						)}
					</div>
					<span className="shrink-0 font-mono text-xs text-muted-foreground">×{formatQuantity(part.quantity)}</span>
				</div>
				{!part.isTool && part.children.length > 0 && (
					<ul className={`border-l border-white/15 pl-3 ${depth < 3 ? "ml-4" : "ml-1"}`}>
						{orderedInputs(part.children).map(({ part: child, index }) => renderInput(child, `${path}.${index}`, depth + 1))}
					</ul>
				)}
			</li>
		);
	}
	return (
		<section aria-label="Acquisition chain" className="min-w-0">
			<h3 className="text-sm font-medium">Acquisition chain</h3>
			<p className="mt-1 text-xs text-muted-foreground">Estimated acquisition costs include full batches. Select a craft or barter to explore its inputs.</p>
			{!!history.length && (
				<nav aria-label="Acquisition navigation" className="mt-3 flex flex-wrap gap-3 text-xs">
					<button type="button" onClick={() => setHistory((previous) => previous.slice(0, -1))} className="flex items-center gap-1 hover:text-tarkov-green">
						<ArrowLeft size={12} />
						Back
					</button>
					<button type="button" onClick={() => setHistory([])} className="text-muted-foreground hover:text-tarkov-green">
						{plan.name}
					</button>
					<span aria-current="page">{focusName}</span>
				</nav>
			)}
			<div className="mt-3 flex items-center gap-3 rounded-lg bg-tarkov-green/[0.06] p-2.5">
				<CraftImage item={items[focus?.part.itemId ?? plan.itemId]} size={40} className="rounded bg-black/20 p-0.5" />
				<div className="min-w-0 flex-1 text-sm">
					<p className="font-medium">{focusName}</p>
					<p className="mt-0.5 text-[11px] text-tarkov-green">
						{focus
							? `${focusSource} · ${formatRoundedRoubles(focus.part.totalCost)} acquisition cost`
							: `${stations[plan.stationId]?.name ?? plan.stationId} · Final output`}
					</p>
				</div>
				<span className="shrink-0 font-mono text-xs text-tarkov-green">×{formatQuantity(focus?.part.quantity ?? plan.count)}</span>
			</div>
			<ul className="ml-4 border-l border-white/15 pl-3">
				{orderedInputs(focus?.part.children ?? plan.requiredItems).map(({ part, index }) => renderInput(part, `${focus?.path ?? "input"}.${index}`, 0))}
			</ul>
		</section>
	);
}
