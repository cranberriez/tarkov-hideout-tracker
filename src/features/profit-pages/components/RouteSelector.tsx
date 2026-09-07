"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { AcquisitionPlan } from "@/lib/price-calculation";
import type { ItemSummary } from "@/types/items";
import type { RouteContext } from "../types";
import {
  acquisitionRouteKey,
  getAcquisitionRoutes,
  hasCheaperLockedRoute,
} from "../utils/recipes";
import { formatCompactPrice } from "../utils/formatters";
import { LockReasons } from "./LockReasons";
import { RouteIcon } from "./RouteIcon";

const routeLabels = {
  flea: "Flea",
  trader: "Trader",
  barter: "Barter",
  craft: "Craft",
} as const;

export function RouteSelector({
  plan,
  item,
  routeContext,
  onSelect,
  onOpen,
  changedFromBase = false,
}: {
  plan: AcquisitionPlan;
  item?: ItemSummary;
  routeContext: RouteContext;
  onSelect: (routeKey: string) => void;
  onOpen?: () => void;
  changedFromBase?: boolean;
}) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null,
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const descriptionId = useId();
  const routes = getAcquisitionRoutes(plan);
  const alternativeCount = plan.alternatives.length;
  const lockedCount = plan.lockedAlternatives?.length ?? 0;
  const automaticFallback = !changedFromBase && hasCheaperLockedRoute(plan);
  const routeDescription = [
    plan.method === "unavailable" ? "No available route" :
      `${routeLabels[plan.method]} · ${changedFromBase ? "selected manually" : "recommended"}`,
    alternativeCount > 0 ? `${alternativeCount} alternative${alternativeCount === 1 ? "" : "s"} available` : "No other available routes",
    ...(lockedCount > 0 ? [`${lockedCount} locked source${lockedCount === 1 ? "" : "s"}`] : []),
    ...(automaticFallback ? ["Using this route because a cheaper source is locked"] : []),
    "Open to compare sources",
  ].join(". ");

  useEffect(() => {
    if (!position) return;
    const close = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest("[data-route-selector]"))
        setPosition(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPosition(null);
    };
    const scroll = (event: Event) => {
      if (event.target instanceof Element && event.target.closest("[data-route-selector]")) return;
      setPosition(null);
    };
    const resize = () => setPosition(null);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", escape);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", resize);
    };
  }, [position]);

  return (
    <>
      <span id={descriptionId} className="sr-only">{routeDescription}</span>
      <button
        ref={buttonRef}
        type="button"
        data-route-selector
        data-isolated-hover="true"
        aria-expanded={position !== null}
        aria-label={`Choose acquisition route for ${item?.name ?? "item"}`}
        title={routeDescription}
        aria-describedby={descriptionId}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (position) return setPosition(null);
          const rect = buttonRef.current?.getBoundingClientRect();
          if (!rect) return;
          onOpen?.();
          setPosition({
            left: Math.min(rect.right + 6, window.innerWidth - 330),
            top: Math.max(8, Math.min(rect.top, window.innerHeight - Math.max(160, routes.length * 42 + (plan.lockedAlternatives ?? []).length * 84) - 16)),
          });
        }}
        className="relative z-10 h-full w-8 shrink-0 self-stretch outline-none ring-inset ring-white/30 hover:brightness-110 hover:ring-1 focus:ring-1 focus:ring-tarkov-green"
      >
        <RouteIcon
          method={plan.method}
          rowRail
          switchable
          changedFromBase={changedFromBase}
          automaticFallback={automaticFallback}
          title={routeDescription}
        />
      </button>
      {position &&
        createPortal(
          <>
            <button
              type="button"
              data-isolated-hover="true"
              aria-label="Close acquisition route picker"
              className="fixed inset-0 z-[129] cursor-default bg-transparent"
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setPosition(null);
              }}
            />
            <span
              data-route-selector
              data-isolated-hover="true"
              className="fixed z-130 space-y-1 block w-[320px] overflow-y-auto overscroll-contain rounded-md border border-white/15 bg-[#05070a] p-1 shadow-[0_18px_55px_rgba(0,0,0,0.8)]"
              style={{ left: Math.max(8, position.left), top: position.top, maxHeight: `calc(100dvh - ${position.top + 8}px)` }}
            >
              {[...routes, ...(plan.lockedAlternatives ?? [])].map((route, index) => {
              const locked = "lockReasons" in route;
              const key = acquisitionRouteKey(route);
              const selected = key === acquisitionRouteKey(plan);
              const sourceName =
                route.method === "trader" && route.traderOffer
                  ? routeContext.tradersById[route.traderOffer.traderId]?.name
                  : route.method === "barter" && route.sourceId
                    ? routeContext.tradersById[
                        routeContext.bartersById[route.sourceId]?.traderId ?? ""
                      ]?.name
                    : route.method === "craft" && route.sourceId
                      ? routeContext.stationsById[
                          routeContext.craftsById[route.sourceId]?.stationId ?? ""
                        ]?.name
                      : undefined;
              const requiredLevel = route.method === "trader"
                ? route.traderOffer?.minTraderLevel
                : route.method === "barter"
                  ? routeContext.bartersById[route.sourceId ?? ""]?.minTraderLevel
                  : route.method === "craft"
                    ? routeContext.craftsById[route.sourceId ?? ""]?.level
                    : undefined;
              return (
                <span key={`${key}:${index}`} className={`block rounded ${locked ? "bg-red-950/40" : ""}`}>
                {locked && <LockReasons reasons={route.lockReasons} />}
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelect(key);
                    setPosition(null);
                  }}
                  className={`grid w-full grid-cols-[18px_48px_30px_minmax(0,1fr)_auto] items-center gap-2 rounded px-2 py-1 text-left transition hover:bg-white/[0.07] ${selected ? locked ? "bg-red-400/10" : "bg-tarkov-green/10" : ""}`}
                >
                  <RouteIcon method={route.method} inline title={locked ? `${routeLabels[route.method]} locked` : routeLabels[route.method]} />
                  <span className="text-[9px] font-bold uppercase text-foreground">
                    {routeLabels[route.method]}
                  </span>
                  {item?.iconLink ? (
                    <Image
                      src={item.iconLink}
                      alt=""
                      width={28}
                      height={28}
                      className="size-7 object-contain"
                      unoptimized
                    />
                  ) : (
                    <span className="size-7" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-[10px] text-white">
                      {item?.name ?? "Unknown item"}
                    </span>
                    {(sourceName || requiredLevel !== undefined) && (
                      <span className="flex gap-1 text-[8px] text-muted-foreground">
                        <span className="truncate">{sourceName ?? "Unknown source"}</span>
                        {requiredLevel !== undefined && <span className="shrink-0">{route.method === "craft" ? `lvl ${requiredLevel}` : `LL${requiredLevel}`}</span>}
                      </span>
                    )}
                  </span>
                  <span
                    className="font-mono text-[10px] text-tarkov-green"
                    title={locked && route.estimatedUnitPrice !== undefined ? "Estimated unit price; route is locked" : undefined}
                  >
                    {formatCompactPrice(
                      locked ? route.estimatedUnitPrice ?? null : plan.quantity > 0 ? route.totalCost / plan.quantity : null,
                    )}
                  </span>
                </button>
                </span>
              );
              })}
            </span>
          </>,
          document.body,
        )}
    </>
  );
}
