"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { AcquisitionPlan } from "@/lib/price-calculation";
import type { ItemSummary } from "@/types/items";
import type { RouteContext } from "../types";
import {
  acquisitionRouteKey,
  getAcquisitionRoutes,
} from "../utils/recipes";
import { formatCompactPrice } from "../utils/formatters";
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
  const routes = getAcquisitionRoutes(plan);

  useEffect(() => {
    if (!position) return;
    const close = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest("[data-route-selector]"))
        setPosition(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPosition(null);
    };
    const scroll = () => setPosition(null);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", escape);
    window.addEventListener("scroll", scroll, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [position]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-route-selector
        data-isolated-hover="true"
        aria-expanded={position !== null}
        aria-label={`Choose acquisition route for ${item?.name ?? "item"}`}
        title="Choose acquisition route"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (position) return setPosition(null);
          const rect = buttonRef.current?.getBoundingClientRect();
          if (!rect) return;
          onOpen?.();
          setPosition({
            left: Math.min(rect.right + 6, window.innerWidth - 330),
            top: Math.min(rect.top, window.innerHeight - routes.length * 42 - 16),
          });
        }}
        className="relative z-10 h-full w-8 shrink-0 self-stretch outline-none ring-inset ring-white/30 hover:brightness-110 hover:ring-1 focus:ring-1 focus:ring-tarkov-green"
      >
        <RouteIcon
          method={plan.method}
          rowRail
          switchable
          changedFromBase={changedFromBase}
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
              className="fixed z-[130] block max-h-[calc(100vh-16px)] w-[320px] overflow-y-auto rounded-md border border-white/15 bg-[#05070a] p-1 shadow-[0_18px_55px_rgba(0,0,0,0.8)]"
              style={{ left: Math.max(8, position.left), top: Math.max(8, position.top) }}
            >
              {routes.map((route) => {
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
              return (
                <button
                  key={key}
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelect(key);
                    setPosition(null);
                  }}
                  className={`grid w-full grid-cols-[18px_48px_30px_minmax(0,1fr)_auto] items-center gap-2 rounded px-2 py-1 text-left transition hover:bg-white/[0.07] ${selected ? "bg-tarkov-green/10" : ""}`}
                >
                  <RouteIcon method={route.method} inline />
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
                    {sourceName && (
                      <span className="block truncate text-[8px] text-muted-foreground">
                        {sourceName}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[10px] text-tarkov-green">
                    {formatCompactPrice(
                      plan.quantity > 0 ? route.totalCost / plan.quantity : null,
                    )}
                  </span>
                </button>
              );
              })}
            </span>
          </>,
          document.body,
        )}
    </>
  );
}
