import Image from "next/image";
import { CircleArrowRight, Wrench } from "lucide-react";
import type { RecipePreviewData, RouteContext } from "../types";
import {
  formatDuration,
  formatQuantity,
  formatRoundedRoubles,
} from "../utils/formatters";
import { routeChipClasses } from "./RouteIcon";

export function RecipePreviewCard({
  preview,
  routeContext,
}: {
  preview: RecipePreviewData;
  routeContext: RouteContext;
}) {
  const barter =
    preview.kind === "barter"
      ? routeContext.bartersById[preview.sourceId]
      : undefined;
  const craft =
    preview.kind === "craft"
      ? routeContext.craftsById[preview.sourceId]
      : undefined;
  const source = barter
    ? routeContext.tradersById[barter.traderId]
    : craft
      ? routeContext.stationsById[craft.stationId]
      : undefined;
  const output = routeContext.itemById[preview.outputItemId];
  const totalCost = preview.requiredItems.reduce<number | null>(
    (total, requirement) =>
      total === null || requirement.totalCost === null
        ? null
        : total + (requirement.isTool ? 0 : requirement.totalCost),
    0,
  );
  return (
    <span className="block min-w-0 flex-1 overflow-hidden rounded-md border border-white/15 bg-[#05070a] shadow-[0_18px_55px_rgba(0,0,0,0.8)]">
      <span className="flex items-center gap-2 border-b border-white/10 bg-white/[0.035] px-3 py-2">
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded border ${preview.kind === "craft" ? "border-orange-400/25 bg-orange-400/10 text-orange-300" : "border-sky-400/25 bg-sky-400/10 text-sky-300"}`}
        >
          {preview.kind === "craft" ? (
            <Wrench className="size-4" />
          ) : (
            <CircleArrowRight className="size-4" />
          )}
        </span>
        {source?.imageLink && (
          <Image
            src={source.imageLink}
            alt=""
            width={30}
            height={30}
            className="size-8 rounded object-contain"
            unoptimized
          />
        )}
        <span className="min-w-0">
          <span className="block truncate text-[11px] font-semibold text-white">
            {source?.name ??
              (preview.kind === "craft" ? "Unknown station" : "Unknown trader")}
            {barter
              ? ` · LL${barter.minTraderLevel}`
              : craft
                ? ` · Level ${craft.level}`
                : ""}
          </span>
          <span className="block truncate text-[10px] text-muted-foreground">
            {preview.kind === "craft"
              ? `Crafts ${output?.name ?? "item"}`
              : `Barters for ${output?.name ?? "item"}`}
            {preview.batches > 1 ? ` · ${preview.batches} batches` : ""}
          </span>
        </span>
      </span>
      <span className="block p-2">
        <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Required items
        </span>
        <span className="block rounded bg-white/[0.035] px-2">
          {preview.requiredItems.map((requirement, index) => {
            const item = routeContext.itemById[requirement.itemId];
            return (
              <span
                key={`${requirement.itemId}:${requirement.isTool === true}:${index}`}
                className="flex h-9 items-center gap-2 border-t border-white/5 first:border-t-0"
              >
                {item?.iconLink ? (
                  <Image
                    src={item.iconLink}
                    alt=""
                    width={30}
                    height={30}
                    className="size-8 shrink-0 object-contain"
                    unoptimized
                  />
                ) : (
                  <span className="size-8 shrink-0" />
                )}
                <span className="min-w-0 flex-1 truncate text-[10px] text-foreground">
                  {item?.name ?? "Unknown item"}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground">
                  ×{formatQuantity(requirement.quantity)}
                </span>
                <span
                  className={`rounded px-1 py-0.5 text-[8px] font-bold uppercase ${routeChipClasses(requirement.method)}`}
                >
                  {requirement.method === "trader"
                    ? "Trader"
                    : requirement.method}
                </span>
                <span className="w-14 text-right font-mono text-[9px] text-tarkov-green">
                  {requirement.isTool
                    ? "Excluded"
                    : formatRoundedRoubles(requirement.totalCost)}
                </span>
              </span>
            );
          })}
          <span className="flex items-center justify-between border-t border-white/10 py-1 font-mono text-[9px]">
            <span className="text-orange-300">
              {preview.kind === "craft" && preview.durationSeconds > 0
                ? `Time ${formatDuration(preview.durationSeconds)}`
                : ""}
            </span>
            <span className="font-semibold text-tarkov-green">
              Total {formatRoundedRoubles(totalCost)}
            </span>
          </span>
        </span>
      </span>
    </span>
  );
}
