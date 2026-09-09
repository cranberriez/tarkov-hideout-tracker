import Image from "next/image";
import type { RecipePreviewData, RouteContext } from "../types";
import {
  formatDuration,
  formatQuantity,
  formatRoundedRoubles,
} from "../utils/formatters";
import { RouteIcon, routeChipClasses } from "./RouteIcon";

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
    <span className="block min-w-0 flex-1 overflow-hidden rounded-md border border-highlight/15 bg-[var(--background)] shadow-[0_18px_55px_color-mix(in_oklab,_var(--shadow)_80%,_transparent)]">
      <span className="flex items-center gap-2 border-b border-highlight/10 bg-highlight/[0.035] px-3 py-2">
        <RouteIcon method={preview.kind} preview filled />
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
          <span className="block truncate text-[11px] font-semibold text-foreground">
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
        <span className="block rounded bg-highlight/[0.035] px-2">
          {preview.requiredItems.map((requirement, index) => {
            const item = routeContext.itemById[requirement.itemId];
            return (
              <span
                key={`${requirement.itemId}:${requirement.isTool === true}:${index}`}
                className="flex h-9 items-center gap-2 border-t border-highlight/5 first:border-t-0"
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
                <span className="w-14 text-right font-mono text-[9px] text-brand">
                  {requirement.isTool
                    ? "Excluded"
                    : formatRoundedRoubles(requirement.totalCost)}
                </span>
              </span>
            );
          })}
          <span className="flex items-center justify-between border-t border-highlight/10 py-1 font-mono text-[9px]">
            <span className="text-warning">
              {preview.kind === "craft" && preview.durationSeconds > 0
                ? `Time ${formatDuration(preview.durationSeconds)}`
                : ""}
            </span>
            <span className="font-semibold text-brand">
              Total {formatRoundedRoubles(totalCost)}
            </span>
          </span>
        </span>
      </span>
    </span>
  );
}
