import Image from "next/image";
import { CornerDownRight, ExternalLink } from "lucide-react";
import type { AcquisitionPlan } from "@/lib/price-calculation";
import type { GoToRecipeHandler, RouteContext } from "../types";
import { formatDuration, formatQuantity, formatRoundedRoubles } from "../utils/formatters";
import { describeChainRoute, getPlanRecipePreview } from "../utils/recipes";
import { routeChipClasses } from "./RouteIcon";
import { itemImageUrl } from "@/lib/utils/item-images";

/** Nested ingredients of one recipe-routed ingredient, rendered directly under its line. */
export function RecipeChainBranch({
	plan,
	routeContext,
	onGoToRecipe,
}: {
	plan: AcquisitionPlan;
	routeContext: RouteContext;
	onGoToRecipe: GoToRecipeHandler;
}) {
	if (!plan.children.length) return null;
	return (
		<div className="mb-1 rounded-sm bg-shadow/20 py-0.5">
			{plan.children.map((child, index) => (
				<RecipeChainNode
					key={`${child.itemId}:${child.isTool === true}:${index}`}
					plan={child}
					depth={1}
					routeContext={routeContext}
					onGoToRecipe={onGoToRecipe}
				/>
			))}
		</div>
	);
}

function RecipeChainNode({
	plan,
	depth,
	routeContext,
	onGoToRecipe,
}: {
	plan: AcquisitionPlan;
	depth: number;
	routeContext: RouteContext;
	onGoToRecipe: GoToRecipeHandler;
}) {
	const item = routeContext.itemById[plan.itemId];
	const preview = getPlanRecipePreview(plan, routeContext);
	const source =
		preview?.kind === "barter"
			? routeContext.tradersById[routeContext.bartersById[preview.sourceId]?.traderId]
			: preview?.kind === "craft"
				? routeContext.stationsById[routeContext.craftsById[preview.sourceId]?.stationId]
				: undefined;
	const canGoToRecipe = Boolean(preview && plan.sourceId && (plan.method === "barter" || plan.method === "craft"));
	return (
		<div>
			<div
				className="group/chain flex min-h-10 min-w-0 items-center gap-2 pr-1 hover:bg-highlight/[0.025]"
				style={{ paddingLeft: `${8 + Math.min(depth - 1, 6) * 18}px` }}
			>
				<CornerDownRight className="size-3.5 shrink-0 text-foreground/25" />
				{item ? (
					<Image
						src={itemImageUrl(item)}
						alt=""
						width={28}
						height={28}
						className="size-7 shrink-0 object-contain"
						unoptimized
					/>
				) : (
					<span className="size-7 shrink-0" />
				)}
				<span className="min-w-0 flex-1">
					<span className="flex min-w-0 items-center gap-1.5">
						<span className="truncate text-xs font-medium text-foreground" title={item?.name}>
							{item?.shortName ?? item?.name ?? "Unknown item"}
						</span>
						<span className="shrink-0 font-mono text-[11px] text-muted-foreground">
							×{formatQuantity(plan.quantity)}
						</span>
						{plan.isTool && (
							<span className="shrink-0 rounded bg-info px-1 py-0.5 text-[7px] font-black uppercase text-inverse">
								tool
							</span>
						)}
					</span>
					<span className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
						<span className={`shrink-0 rounded px-1 text-[8px] font-bold uppercase ${routeChipClasses(plan.method)}`}>
							{plan.method === "empty" ? "Empty value" : plan.method === "trader" ? "Trader" : plan.method}
						</span>
						<span className="truncate">
							{source ? `${source.name} · ` : ""}
							{describeChainRoute(plan, routeContext)}
						</span>
					</span>
				</span>
				<span className="flex shrink-0 flex-col items-end">
					<span className="font-mono text-xs text-foreground">
						{plan.isTool ? "Excluded" : formatRoundedRoubles(plan.totalCost)}
					</span>
					{plan.durationSeconds > 0 && (
						<span className="font-mono text-[10px] text-warning">{formatDuration(plan.durationSeconds)}</span>
					)}
				</span>
				{canGoToRecipe ? (
					<button
						type="button"
						title={`Go to ${plan.method} recipe`}
						aria-label={`Go to ${plan.method} recipe for ${item?.name ?? "item"}`}
						onClick={() => onGoToRecipe(plan.method as "barter" | "craft", plan.sourceId as string)}
						className="hidden size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition hover:bg-highlight/10 hover:text-brand focus:opacity-100 group-hover/chain:opacity-100 lg:flex"
					>
						<ExternalLink className="size-3.5" />
					</button>
				) : (
					<span className="hidden size-6 shrink-0 lg:block" />
				)}
			</div>
			{plan.children.map((child, index) => (
				<RecipeChainNode
					key={`${child.itemId}:${child.isTool === true}:${index}`}
					plan={child}
					depth={depth + 1}
					routeContext={routeContext}
					onGoToRecipe={onGoToRecipe}
				/>
			))}
		</div>
	);
}
