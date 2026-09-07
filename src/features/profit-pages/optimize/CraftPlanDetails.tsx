"use client";

import { ArrowDown, ArrowUpRight, ShoppingBasket } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ItemSummary } from "@/types/items";
import type { ProfitStationSource } from "../types";
import { formatDuration, formatQuantity, formatRoundedRoubles } from "../utils/formatters";
import { craftWindowProfitHour, placeCraftPlan, type CraftBooking, type CraftPlan } from "./craft-plans";
import { CraftImage } from "./CraftImage";

export function CraftPlanDetails({ plan, items, stations, traders, slots, bookings, target, cadence, continuousRate, onClose, onItemOpen }: {
  plan: CraftPlan | null;
  items: Readonly<Record<string, ItemSummary>>;
  stations: Record<string, ProfitStationSource>;
  traders: Record<string, { name: string }>;
  slots: number;
  bookings: CraftBooking[];
  target: number;
  cadence: number;
  continuousRate?: number;
  onClose: () => void;
  onItemOpen: (id: string) => void;
}) {
  const scheduled = bookings.filter(booking => booking.planId === plan?.id);
  const steps = plan ? (scheduled.length ? scheduled : placeCraftPlan(plan, [], slots) ?? []).sort((a, b) => a.start - b.start) : [];
  const finish = Math.max(0, ...steps.map(step => step.finish));
  return <Dialog open={!!plan} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto p-5 sm:max-w-xl sm:p-6">
      {plan && <>
        <div className="mb-5 flex items-center gap-4 pr-6">
          <CraftImage item={items[plan.itemId]} size={76} className="rounded-lg bg-black/20 p-2" />
          <div>
            <DialogTitle className="leading-snug">{plan.name}</DialogTitle>
            <DialogDescription className="mt-2">{plan.steps.length} {plan.steps.length === 1 ? "craft" : "linked crafts"} · ready in {formatDuration(finish)}</DialogDescription>
            <button type="button" onClick={() => { onClose(); onItemOpen(plan.itemId); }} className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">Item details<ArrowUpRight size={12} aria-hidden="true" /></button>
          </div>
        </div>
        <div className="mb-5 flex flex-wrap gap-6 text-sm">
          <span>Sales <span className="ml-1 font-mono">{formatRoundedRoubles(plan.cost + plan.profit)}</span><span className="mt-1 block text-xs text-muted-foreground">{plan.sellSourceLabel ?? "Estimated sale"} · ×{formatQuantity(plan.count)}</span></span>
          <span>− Inputs <span className="ml-1 font-mono">{formatRoundedRoubles(plan.cost)}</span></span>
          <span>= Profit <strong className="ml-1 font-mono text-tarkov-green">+{formatRoundedRoubles(plan.profit)}</strong></span>
        </div>
        <p className="mb-4 rounded-lg bg-white/5 p-3 text-xs text-muted-foreground">{continuousRate !== undefined ? <><span className="font-mono text-foreground">{formatRoundedRoubles(continuousRate)}/h</span> averaged over 24 hours, including shared-station waits. Sales and inputs above are per batch.</> : <><span className="font-mono text-foreground">{formatRoundedRoubles(craftWindowProfitHour(plan.profit, finish, scheduled.length ? cadence : target))}/h</span> over {formatDuration(Math.max(finish, scheduled.length ? cadence : target))}, including wait{scheduled.length ? " for your next run" : " before restarting"}.</>} Before fuel and flea fees.</p>
        <ol aria-label="Craft steps" className="space-y-2">
          {steps.map(({ step, start, finish }) => <li key={step.id}>
            {step.after.length > 0 && <div className="mb-2 flex items-center gap-2 pl-5 text-xs text-muted-foreground"><ArrowDown size={14} aria-hidden="true" />After {step.after.map(id => plan.steps.find(parent => parent.id === id)?.name ?? id).filter((name, index, all) => all.indexOf(name) === index).join(", ")}</div>}
            <div className={`flex items-center gap-3 rounded-lg border p-3 ${step.id === "output" ? "border-tarkov-green/30 bg-tarkov-green/[0.06]" : "border-white/10 bg-white/[0.03]"}`}>
              <CraftImage item={items[step.itemId]} size={42} />
              <div className="min-w-0 flex-1"><p className="text-sm">{step.name} <span className="text-muted-foreground">×{formatQuantity(step.count)}</span></p><p className="mt-1 text-xs text-muted-foreground">{stations[step.stationId]?.name ?? step.stationId}</p></div>
              <span className="shrink-0 text-right text-xs"><span className="block font-mono">{formatDuration(start)} → {formatDuration(finish)}</span><span className="mt-1 block text-muted-foreground">{step.id === "output" ? "Ready to sell" : "Used in chain"}</span></span>
            </div>
          </li>)}
        </ol>
        <section aria-label="Shopping list" className="mt-5 rounded-lg border border-white/10 p-3">
          <h3 className="text-sm"><ShoppingBasket size={14} className="mr-2 inline" aria-hidden="true" />Buy inputs <span className="text-muted-foreground">· {plan.shopping.length} {plan.shopping.length === 1 ? "item" : "items"}</span></h3>
          <ul className="mt-3 space-y-2">{plan.shopping.map(item => <li key={`${item.itemId}:${item.sourceId ?? 'flea'}`} className="flex items-center gap-2 text-sm"><CraftImage item={items[item.itemId]} size={30} /><span className="min-w-0 flex-1">{item.name} <span className="text-muted-foreground">×{formatQuantity(item.count)}</span><span className="block text-xs text-muted-foreground">{item.traderId ? traders[item.traderId]?.name ?? `Trader ${item.traderId}` : "Flea market"}</span></span><span className="font-mono text-xs">{formatRoundedRoubles(item.cost)}</span></li>)}</ul>
        </section>
        {!!plan.exchanges?.length && <section aria-label="Barter exchanges" className="mt-3 rounded-lg border border-white/10 p-3">
          <h3 className="text-sm">Exchange inputs</h3>
          <ol className="mt-3 space-y-3">{plan.exchanges.map(exchange => <li key={exchange.id} className="flex items-center gap-3 text-sm">
            <CraftImage item={items[exchange.itemId]} size={36} />
            <div><p>{items[exchange.itemId]?.name ?? exchange.itemId} ×{formatQuantity(exchange.count)} <span className="text-xs text-muted-foreground">· {traders[exchange.traderId]?.name ?? `Trader ${exchange.traderId}`}</span></p>
              <p className="mt-1 text-xs text-muted-foreground">Give {exchange.inputs.map(item => `${formatQuantity(item.count)} × ${items[item.itemId]?.name ?? item.itemId}`).join(', ')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{exchange.after.length ? `After ${exchange.after.map(id => plan.steps.find(step => step.id === id)?.name ?? id).join(', ')}` : 'Before crafting'} · exchange in listed order</p>
            </div>
          </li>)}</ol>
        </section>}
        <p className="mt-4 text-xs text-muted-foreground">Tools assumed owned. Collect and restart at each step. Batch leftovers are not valued.</p>
      </>}
    </DialogContent>
  </Dialog>;
}
