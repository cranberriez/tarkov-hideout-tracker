import type { CurrentPrice } from "../../types/prices";
import type { SummaryRow } from "./summary-model";

export type ItemAction = "KEEP" | "HOLD" | "SELL";
export function decideUploaderRow(row: SummaryRow, price: CurrentPrice | undefined, state: string | undefined, partial: boolean, now: number): { action: ItemAction; why: string; pending?: boolean } {
	if (row.category === "save") return { action: "KEEP", why: "These FIR copies are reserved for remaining hideout or quest requirements." };
	if (row.category === "needed") return { action: "KEEP", why: "Needed for progression. Non-FIR replacements are accepted, but selling and rebuying has not been evaluated." };
	if (row.category === "review") return { action: "HOLD", why: row.foundInRaid === "unknown" ? "Confirm the FIR badge in review before deciding what to do with these copies." : "This is a quest hand-in alternative. Choose which accepted item to keep." };
	if (partial) return { action: "HOLD", why: "Some quest alternatives are only partially listed. Check those objectives before selling." };
	if (state === "pending") return { action: "HOLD", why: "Loading prices before making a market suggestion.", pending: true };
	if (state === "error") return { action: "HOLD", why: "Price loading failed. Retry prices before deciding." };
	const change = price?.changeLast48hPercent;
	if (!price || price.fleaStability !== "stable" || !price.price || !Number.isFinite(price.price) || !price.updatedAt || now - price.updatedAt > 72 * 60 * 60 * 1000 || price.fleaPriceReasons?.includes("stale") || typeof change !== "number" || !Number.isFinite(change))
		return { action: "HOLD", why: "Not enough reliable current price data for a sell suggestion." };
	if (change <= -5) return { action: "SELL", why: `No eligible requirement reserves these copies, and the price fell ${Math.abs(change).toFixed(1)}% over 48 hours. Selling is a suggestion for surplus only; compare offers and fees before listing. The decline may not continue.` };
	if (change >= 5) return { action: "HOLD", why: `The price rose ${change.toFixed(1)}% over 48 hours. Consider holding surplus; further increases are not guaranteed.` };
	return { action: "HOLD", why: "The 48-hour change is within ±5%. No strong price signal—keeping or selling surplus is your choice." };
}
