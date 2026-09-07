"use client";

import { ArrowRight, Check, ChevronDown, Link2, Pause, ShoppingBasket } from "lucide-react";
import { useState } from "react";
import type { ItemSummary } from "@/types/items";
import type { ProfitStationSource } from "../types";
import { formatDuration, formatRoundedRoubles } from "../utils/formatters";
import { craftWindowProfitHour, type CraftPlan } from "./craft-plans";
import { CraftImage } from "./CraftImage";

export function CraftRecommendations({ groups, stationIds, stations, items, selected, slots, target, cadence, readyAt, continuousRates, onSelect, onInspect }: {
  groups: Map<string, CraftPlan[]>;
  stationIds: string[];
  stations: Record<string, ProfitStationSource>;
  items: Readonly<Record<string, ItemSummary>>;
  selected: CraftPlan[];
  slots: number;
  target: number;
  cadence: number;
  continuousRates?: Record<string, number>;
  readyAt: Record<string, number>;
  onSelect: (stationId: string, planId: string | null) => void;
  onInspect: (planId: string) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  return <div className="grid items-start gap-4 xl:grid-cols-2">
    {stationIds.map(stationId => {
      const all = groups.get(stationId) ?? [];
      const current = selected.filter(plan => plan.stationId === stationId);
      const shown = expanded[stationId] ? all : all.slice(0, 2);
      const station = stations[stationId];
      return <section key={stationId} aria-label={station?.name ?? stationId} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.025] p-3">
        <div className="mb-2 flex items-center gap-2">
          <CraftImage src={station?.imageLink} size={30} />
          <h3 className="flex-1 text-sm font-semibold">{station?.name ?? stationId}</h3>
          <span className="text-xs text-muted-foreground">{current.length}/{slots} selected</span>
          {all.length > 0 && <button type="button" aria-label={`Skip ${station?.name ?? stationId} recommendation`} title="Skip sale crafts; the station can still supply a chain" aria-pressed={!current.length}
            onClick={() => onSelect(stationId, current.length ? null : all[0].id)} className={`rounded p-2 hover:bg-white/10 ${!current.length ? "text-amber-300" : "text-muted-foreground"}`}>
            <Pause size={14} aria-hidden="true" />
          </button>}
        </div>
        {!shown.length && <p className="py-5 text-center text-sm text-muted-foreground">No available profitable crafts</p>}
        <div className={`grid gap-2 ${shown.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {shown.map(plan => {
            const active = current.some(choice => choice.id === plan.id);
            const window = active ? cadence : Math.max(target, plan.duration);
            const difference = plan.duration - target;
            const queued = active && (readyAt[plan.id] ?? 0) > plan.duration + 1;
            return <article key={plan.id} className={`flex min-w-0 flex-col overflow-hidden rounded-lg border transition-colors ${active ? "border-tarkov-green/70 bg-tarkov-green/[0.08]" : "border-white/10 bg-black/15 hover:border-white/25"}`}>
              <button type="button" aria-pressed={active} aria-label={`Choose ${plan.name}`} onClick={() => onSelect(stationId, plan.id)} className="flex flex-1 flex-col p-3 text-left">
                <div className="flex w-full items-center gap-2">
                  <CraftImage item={items[plan.itemId]} size={56} className="shrink-0 rounded-md bg-black/20 p-1" />
                  <span className="min-w-0 flex-1 text-xs font-medium leading-snug">{plan.name}{plan.count > 1 && <span className="ml-1 text-muted-foreground">×{plan.count}</span>}</span>
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center self-start rounded-full border ${active ? "border-tarkov-green bg-tarkov-green text-black" : "border-white/20"}`}>{active && <Check size={10} aria-hidden="true" />}</span>
                </div>
                <span className="mt-3 flex w-full flex-wrap items-baseline justify-between gap-1 border-t border-white/10 pt-2">
                  <span className="font-mono text-xs text-muted-foreground">{formatDuration(plan.duration)}</span>
                  <span className="font-mono text-sm font-medium text-tarkov-green">+{formatRoundedRoubles(plan.profit)}</span>
                </span>
                <span className="mt-1 text-xs text-muted-foreground">{formatRoundedRoubles(continuousRates ? (active ? continuousRates[plan.id] ?? 0 : craftWindowProfitHour(plan.profit, plan.duration, 0)) : craftWindowProfitHour(plan.profit, plan.duration, window))}/h · {continuousRates ? active ? "day average" : "standalone" : active ? "your run" : "with wait"}</span>
                <span className={`mt-1 text-xs ${queued || difference > 0 ? "text-amber-200/80" : "text-muted-foreground"}`}>
                  {queued ? `Ready in ${formatDuration(readyAt[plan.id])} · shared station` : continuousRates ? "Restart when ready" : Math.abs(difference) < 30 ? "Right on time" : `${formatDuration(Math.abs(difference))} ${difference > 0 ? "longer" : "to spare"}`}
                </span>
              </button>
              <button type="button" onClick={() => onInspect(plan.id)} aria-label={`Details for ${plan.name}`} className="flex items-center gap-1.5 border-t border-white/10 px-3 py-2.5 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground">
                {plan.hasChain ? <Link2 size={13} aria-hidden="true" /> : <ShoppingBasket size={13} aria-hidden="true" />}
                <span>{plan.hasChain ? `${plan.steps.length}-step chain` : plan.exchanges?.length ? "Barter inputs" : plan.shopping.some(item => item.traderId) ? "Trader inputs" : "Flea inputs"}{plan.hasChain && !!plan.exchanges?.length ? " · barters" : ""}</span>
                {plan.hasChain && <span className="ml-1 flex -space-x-1">{plan.steps.filter(step => step.id !== "output").slice(0, 3).map(step => <CraftImage key={step.id} item={items[step.itemId]} size={20} className="rounded bg-black/30" />)}</span>}
                <ArrowRight size={13} className="ml-auto" aria-hidden="true" />
              </button>
            </article>;
          })}
        </div>
        {all.length > 2 && <button type="button" className="mt-3 flex w-full items-center justify-center gap-1.5 py-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded(previous => ({ ...previous, [stationId]: !previous[stationId] }))}>
          {expanded[stationId] ? "Show less" : `${all.length - 2} more ${all.length === 3 ? "craft" : "crafts"}`}<ChevronDown size={13} className={expanded[stationId] ? "rotate-180" : ""} aria-hidden="true" />
        </button>}
      </section>;
    })}
  </div>;
}
