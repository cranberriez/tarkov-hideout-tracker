import Image from "next/image";
import { CornerDownRight, ExternalLink } from "lucide-react";
import type {
  AcquisitionPlan,
  RecipeEvaluation,
} from "@/lib/price-calculation";
import type { GoToRecipeHandler, RouteContext } from "../types";
import {
  formatDuration,
  formatQuantity,
  formatRoundedRoubles,
} from "../utils/formatters";
import { describeChainRoute, getPlanRecipePreview } from "../utils/recipes";
import { routeChipClasses } from "./RouteIcon";

export function RecipeChain({
  evaluation,
  routeContext,
  onGoToRecipe,
}: {
  evaluation: RecipeEvaluation;
  routeContext: RouteContext;
  onGoToRecipe: GoToRecipeHandler;
}) {
  const recipeBranches = evaluation.requiredItems.filter(
    (plan) => plan.method === "barter" || plan.method === "craft",
  );
  return (
    <div className="border-t border-white/10 bg-black/15">
      {recipeBranches.map((plan, index) => (
        <div
          key={`${plan.itemId}:${plan.isTool === true}:${index}`}
          className="border-t border-white/10 first:border-t-0"
        >
          <RecipeChainNode
            plan={plan}
            depth={0}
            root
            routeContext={routeContext}
            onGoToRecipe={onGoToRecipe}
          />
          {plan.children.map((child, childIndex) => (
            <RecipeChainNode
              key={`${child.itemId}:${child.isTool === true}:${childIndex}`}
              plan={child}
              depth={1}
              routeContext={routeContext}
              onGoToRecipe={onGoToRecipe}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function RecipeChainNode({
  plan,
  depth,
  routeContext,
  onGoToRecipe,
  root = false,
}: {
  plan: AcquisitionPlan;
  depth: number;
  routeContext: RouteContext;
  onGoToRecipe: GoToRecipeHandler;
  root?: boolean;
}) {
  const item = routeContext.itemById[plan.itemId];
  const preview = getPlanRecipePreview(plan, routeContext);
  const source =
    preview?.kind === "barter"
      ? routeContext.tradersById[
          routeContext.bartersById[preview.sourceId]?.traderId
        ]
      : preview?.kind === "craft"
        ? routeContext.stationsById[
            routeContext.craftsById[preview.sourceId]?.stationId
          ]
        : undefined;
  return (
    <div>
      <div
        className={`group/chain flex min-h-10 items-center gap-2 pr-3 hover:bg-white/[0.025] ${root ? "min-h-12 bg-white/[0.02]" : ""}`}
        style={{ paddingLeft: `${12 + Math.min(depth, 8) * 24}px` }}
      >
        {!root && (
          <CornerDownRight className="size-3.5 shrink-0 text-white/25" />
        )}
        {item?.iconLink ? (
          <Image
            src={item.iconLink}
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 object-contain"
            unoptimized
          />
        ) : (
          <span className="size-8 shrink-0" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-medium text-foreground">
            {item?.name ?? "Unknown item"}
          </span>
          <span className="block truncate text-[9px] text-muted-foreground">
            {source ? `${source.name} · ` : ""}
            {describeChainRoute(plan, routeContext)}
          </span>
        </span>
        {plan.isTool && (
          <span className="rounded bg-sky-400 px-1 py-0.5 text-[7px] font-black uppercase text-black">
            tool
          </span>
        )}
        <span className="font-mono text-[10px] text-muted-foreground">
          ×{formatQuantity(plan.quantity)}
        </span>
        <span
          className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ${routeChipClasses(plan.method)}`}
        >
          {plan.method === "trader" ? "Trader" : plan.method}
        </span>
        <span className="w-20 text-right font-mono text-[10px] text-foreground">
          {plan.isTool ? "Excluded" : formatRoundedRoubles(plan.totalCost)}
        </span>
        {plan.durationSeconds > 0 && (
          <span className="w-16 text-right font-mono text-[10px] text-orange-300">
            {formatDuration(plan.durationSeconds)}
          </span>
        )}
        {preview &&
          plan.sourceId &&
          (plan.method === "barter" || plan.method === "craft") && (
            <button
              type="button"
              title={`Go to ${plan.method} recipe`}
              onClick={() =>
                onGoToRecipe(
                  plan.method as "barter" | "craft",
                  plan.sourceId as string,
                )
              }
              className="flex size-6 items-center justify-center rounded text-muted-foreground opacity-0 transition hover:bg-white/10 hover:text-tarkov-green group-hover/chain:opacity-100 focus:opacity-100"
            >
              <ExternalLink className="size-3.5" />
            </button>
          )}
      </div>
      {!root && plan.children.length > 0 && (
        <div>
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
      )}
    </div>
  );
}
