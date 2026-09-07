import { createRecipeCalculator } from "../../../lib/price-calculation/optimizer";
import { getFleaLockReasons, getRecipeLockReasons, getTraderLockReasons } from "../../../lib/price-calculation/availability";
import { craftingDuration } from "../../../lib/price-calculation/crafting-skill";
import { isTrackedCraft } from "../../../lib/price-calculation/craft-rules";
import type { AcquisitionPlan, RecipeCalculatorInput } from "../../../lib/price-calculation/types";
export type CraftRanking = "target" | "duration" | "profit-hour" | "profit";
export interface ScheduleCandidate {
  id: string;
  stationId: string;
  name: string;
  duration: number;
  profit: number;
  cost: number;
}

export interface CraftStep {
  id: string;
  recipeId: string;
  stationId: string;
  itemId: string;
  name: string;
  count: number;
  duration: number;
  after: string[];
}
export interface CraftShoppingItem { itemId: string; name: string; count: number; cost: number; sourceId?: string; traderId?: string }
export interface CraftExchange { id: string; itemId: string; count: number; traderId: string; after: string[]; inputs: { itemId: string; count: number }[] }
export interface CraftPlan extends ScheduleCandidate {
  sellSourceLabel?: string;
  rootRecipeId: string;
  itemId: string;
  count: number;
  steps: CraftStep[];
  requiredItems: AcquisitionPlan[];
  shopping: CraftShoppingItem[];
  exchanges?: CraftExchange[];
  hasChain: boolean;
}
export interface CraftBooking {
  round?: number;
  planId: string;
  step: CraftStep;
  lane: number;
  start: number;
  finish: number;
}

/** List scheduling with gap insertion. All times are seconds from session start. */
export function placeCraftPlan(plan: CraftPlan, reserved: CraftBooking[] = [], slots = 1, earliest = 0): CraftBooking[] | null {
  const capacity = slots >= 2 ? 2 : 1;
  const placed: CraftBooking[] = [];
  const done = new Map<string, CraftBooking>();
  for (const step of plan.steps) {
    if (!(step.duration > 0) || !Number.isFinite(step.duration) || done.has(step.id) || step.after.some(id => !done.has(id))) return null;
    const ready = Math.max(earliest, ...step.after.map(id => done.get(id)!.finish));
    let best: CraftBooking | undefined;
    for (let lane = 0; lane < capacity; lane++) {
      // Even at Elite, the same recipe cannot occupy both slots at once.
      const blocks = [...reserved, ...placed].filter(booking => booking.step.stationId === step.stationId &&
        (booking.lane === lane || booking.step.recipeId === step.recipeId)).sort((a, b) => a.start - b.start);
      let start = ready;
      for (const block of blocks) {
        if (start + step.duration <= block.start) break;
        if (start < block.finish) start = block.finish;
      }
      if (!best || start < best.start) best = { planId: plan.id, step, lane, start, finish: start + step.duration };
    }
    placed.push(best!);
    done.set(step.id, best!);
  }
  return placed;
}

/** The engine picks acquisition routes; this adapter expands full batches for execution.
 * Purchases and exchanges take no station time; crafted barter inputs retain dependencies.
 */
export function getCraftPlans(input: RecipeCalculatorInput, includeChains: boolean, sources = { traders: true, barters: true }) {
  const crafts = new Map(input.crafts.filter(isTrackedCraft).map(craft => [craft.id, craft]));
  const barters = new Map(input.barters.map(barter => [barter.id, barter]));
  const plans: CraftPlan[] = [];
  const excluded = new Set<string>();
  for (const chains of includeChains ? [false, true] : [false]) {
    const calculator = createRecipeCalculator({ ...input, allowCrafts: chains, allowBarters: sources.barters, allowTraderPurchases: sources.traders, maxDepth: 6 });
    for (const row of calculator.evaluateCrafts()) {
      excluded.add(row.id);
      if (!row.craft || row.lockReasons.length || row.cost === null || row.profit === null || !Number.isFinite(row.profit) || row.profit <= 0 ||
        getFleaLockReasons(input.itemsById[row.outputItemId], input.playerLevel).length) continue;
      const steps: CraftStep[] = [];
      const shopping = new Map<string, CraftShoppingItem>();
      const exchanges: CraftExchange[] = [];
      let valid = true;
      function expand(part: AcquisitionPlan, path: string, tool = false): string[] {
        if (!valid || steps.length > 200 || !Number.isFinite(part.quantity) || part.quantity <= 0 || part.totalCost === null || !Number.isFinite(part.totalCost)) {
          valid = false; return [];
        }
        const ownedTool = tool || part.isTool === true;
        if (part.method === "flea" || part.method === "trader") {
          if (part.method === "flea" ? getFleaLockReasons(input.itemsById[part.itemId], input.playerLevel).length
            : !sources.traders || !part.traderOffer || getTraderLockReasons(part.traderOffer, input).length) { valid = false; return []; }
          if (!ownedTool) {
            const key = `${part.itemId}:${part.sourceId ?? "flea"}`;
            const previous = shopping.get(key);
            shopping.set(key, { itemId: part.itemId, name: input.itemsById[part.itemId]?.name ?? part.itemId,
              ...(part.method === "trader" ? { sourceId: part.sourceId, traderId: part.traderOffer!.traderId } : {}),
              count: (previous?.count ?? 0) + part.quantity, cost: (previous?.cost ?? 0) + part.totalCost });
          }
          return [];
        }
        if (part.method === "barter") {
          const barter = part.sourceId ? barters.get(part.sourceId) : undefined;
          if (!sources.barters || !barter || getRecipeLockReasons(barter, input).length || !barter.requiredItems.length ||
            barter.offeredItemId !== part.itemId || barter.offeredCount <= 0 || !Number.isInteger(part.batches) || part.batches <= 0 || part.batches > 200 || !part.children.length) {
            valid = false; return [];
          }
          const after = part.children.flatMap((child, index) => expand(child, `${path}.${index}`, ownedTool));
          if (!ownedTool) exchanges.push({ id: path, itemId: part.itemId, count: barter.offeredCount * part.batches,
            traderId: barter.traderId, after, inputs: part.children.filter(child => !child.isTool).map(child => ({ itemId: child.itemId, count: child.quantity })) });
          return after;
        }
        const craft = part.method === "craft" && part.sourceId ? crafts.get(part.sourceId) : undefined;
        if (!craft || getRecipeLockReasons(craft, input).length || craft.requiredQuestItems.length || !craft.requiredItems.length ||
          !Number.isInteger(part.batches) || part.batches <= 0 || part.batches > 200 || craft.productCount <= 0 ||
          craft.productItemId !== part.itemId || !part.children.length) { valid = false; return []; }
        const after = part.children.flatMap((child, index) => expand(child, `${path}.${index}`, ownedTool));
        if (ownedTool) return []; // Reusable tools are assumed owned, not produced every run.
        const ids: string[] = [];
        for (let batch = 0; batch < part.batches; batch++) {
          const id = `${path}:${batch}`;
          steps.push({ id, recipeId: craft.id, stationId: craft.stationId, itemId: part.itemId,
            name: input.itemsById[part.itemId]?.name ?? part.itemId, count: craft.productCount,
            duration: craftingDuration(craft, input.craftingSkillLevel), after: [...after, ...ids.slice(-1)] });
          ids.push(id);
        }
        return ids;
      }
      const after = row.requiredItems.flatMap((part, index) => expand(part, `input.${index}`));
      if (!valid || steps.length > 200 || !Number.isFinite(row.cost)) continue;
      const hasChain = steps.length > 0;
      if (chains && !hasChain) continue; // The direct variant already represents this route.
      steps.push({ id: "output", recipeId: row.id, stationId: row.craft.stationId, itemId: row.outputItemId,
        name: input.itemsById[row.outputItemId]?.name ?? row.outputItemId, count: row.outputCount,
        duration: row.craft.duration, after });
      const plan: CraftPlan = { id: `${row.id}:${hasChain ? "chain" : "buy"}`, rootRecipeId: row.id,
        stationId: row.craft.stationId, itemId: row.outputItemId, name: input.itemsById[row.outputItemId]?.name ?? row.outputItemId,
        count: row.outputCount, cost: row.cost, profit: row.profit, sellSourceLabel: row.sellSourceLabel, duration: 0, steps, requiredItems: row.requiredItems, shopping: [...shopping.values()], exchanges, hasChain };
      const bookings = placeCraftPlan(plan, [], (input.craftingSkillLevel ?? 0) >= 51 ? 2 : 1);
      if (!bookings) continue;
      plan.duration = Math.max(...bookings.map(booking => booking.finish));
      plans.push(plan);
    }
  }
  for (const plan of plans) excluded.delete(plan.rootRecipeId);
  return { plans, excluded: excluded.size };
}

/** Keep one route per output recipe so the two visible options are distinct crafts. */
export function recommendCraftPlans(plans: CraftPlan[], ranking: CraftRanking, target: number) {
  const groups = new Map<string, CraftPlan[]>();
  const score = (plan: CraftPlan) => ranking === "target" ? -Math.abs(plan.duration - target)
    : ranking === "duration" ? plan.duration : ranking === "profit" ? plan.profit : craftWindowProfitHour(plan.profit, plan.duration, target);
  const sorted = [...plans].sort((a, b) => score(b) - score(a) || a.steps.length - b.steps.length || b.profit - a.profit || a.id.localeCompare(b.id));
  const seen = new Set<string>();
  for (const plan of sorted) {
    if (seen.has(plan.rootRecipeId)) continue;
    seen.add(plan.rootRecipeId);
    groups.set(plan.stationId, [...(groups.get(plan.stationId) ?? []), plan]);
  }
  return groups;
}

/** A completed craft earns nothing while waiting for the next run. */
export function craftWindowProfitHour(profit: number, duration: number, target: number) {
  const occupied = Math.max(duration, target);
  return occupied > 0 ? profit * 3600 / occupied : 0;
}

export function selectStationPlans(available: CraftPlan[], choice: string[] | undefined, slots: number) {
  const capacity = slots >= 2 ? 2 : 1;
  if (choice === undefined) return available.slice(0, capacity);
  return choice.flatMap(id => available.find(plan => plan.id === id) ?? []).slice(0, capacity);
}

/** Selecting a third Elite craft replaces the oldest selection; selected cards toggle off. */
export function toggleStationPlan(current: string[], id: string, slots: number) {
  if (current.includes(id)) return current.filter(value => value !== id);
  return [...current, id].slice(-(slots >= 2 ? 2 : 1));
}

/** Reserve entire chains together, then fit other selected station jobs into free gaps. */
export function buildCraftSession(plans: CraftPlan[], slots = 1) {
  const bookings: CraftBooking[] = [];
  for (const plan of [...plans].sort((a, b) => Number(b.hasChain) - Number(a.hasChain) || b.duration - a.duration || a.id.localeCompare(b.id))) {
    const next = placeCraftPlan(plan, bookings, slots);
    if (next) bookings.push(...next);
  }
  return bookings.sort((a, b) => a.start - b.start || a.step.stationId.localeCompare(b.step.stationId) || a.lane - b.lane);
}

/** Independently repeat complete chains. Reserve suppliers before consumers, with gap insertion.
 * Earliest available chain goes first; oldest waiting request then profit/hour break ties.
 */
export function buildContinuousSession(plans: CraftPlan[], slots = 1, horizon = 86400, maxBookings = 2000) {
  const bookings: CraftBooking[] = [];
  const nextAt = new Map<string, number>();
  const counts: Record<string, number> = {};
  if (!Number.isFinite(horizon) || horizon <= 0) return { bookings, counts, profit: 0, truncated: false };
  let truncated = false;
  for (;;) {
    let best: { plan: CraftPlan; jobs: CraftBooking[]; start: number; finish: number } | undefined;
    for (const plan of plans) {
      const jobs = placeCraftPlan(plan, bookings, slots, nextAt.get(plan.id) ?? 0);
      if (!jobs?.length) continue;
      const finish = Math.max(...jobs.map(job => job.finish));
      if (finish > horizon) continue; // Do not purchase/start incomplete end-of-day chains.
      const start = Math.min(...jobs.map(job => job.start));
      const waitingSince = nextAt.get(plan.id) ?? 0;
      const bestWaitingSince = best ? nextAt.get(best.plan.id) ?? 0 : 0;
      if (!best || start < best.start || (start === best.start && (waitingSince < bestWaitingSince || (waitingSince === bestWaitingSince &&
        (plan.profit / plan.duration > best.plan.profit / best.plan.duration ||
          (plan.profit / plan.duration === best.plan.profit / best.plan.duration && plan.id < best.plan.id)))))) {
        best = { plan, jobs, start, finish };
      }
    }
    if (!best) break;
    if (bookings.length + best.jobs.length > maxBookings) { truncated = true; break; }
    const round = counts[best.plan.id] ?? 0;
    bookings.push(...best.jobs.map(job => ({ ...job, round })));
    counts[best.plan.id] = round + 1;
    nextAt.set(best.plan.id, best.finish);
  }
  bookings.sort((a, b) => a.start - b.start || a.step.stationId.localeCompare(b.step.stationId) || a.lane - b.lane);
  const profit = plans.reduce((sum, plan) => sum + plan.profit * (counts[plan.id] ?? 0), 0);
  return { bookings, counts, profit, truncated };
}

/** Keep chosen outputs visible when a station is collapsed, then fill by rank. */
export function collapsedStationPlans(ranked: CraftPlan[], selected: CraftPlan[]): CraftPlan[] {
  const selectedIds = new Set(selected.map(plan => plan.id));
  return [...ranked.filter(plan => selectedIds.has(plan.id)), ...ranked.filter(plan => !selectedIds.has(plan.id))].slice(0, 2);
}
