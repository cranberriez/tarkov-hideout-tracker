"use client";

import { useEffect, useMemo, useState } from "react";
import { decideSurplus, unitSellValue, type ItemAction, type SurplusDecision } from "./decision-model";
import type { ReviewEntry } from "./review-model";
import type { SummaryRow } from "./summary-model";
import type { useUploaderSummary } from "./useUploaderSummary";

export const decisionKey = (id: string, fir: string) => `${id}:${fir}`;
export type DecisionFilter = ItemAction | "ALL";
export interface EntryDecision {
	key: string;
	action: ItemAction;
	pending: boolean;
}

/**
 * Splits each item/FIR group into kept and surplus units, then hands units to screenshot boxes
 * and manual additions in order, so the first copies on the image carry the kept quantity.
 */
export function useUploaderDecisions(data: ReturnType<typeof useUploaderSummary>, entries: readonly ReviewEntry[]) {
	const [selected, setSelected] = useState<string | null>(null);
	const [filter, setFilter] = useState<DecisionFilter>("ALL");
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 60_000);
		return () => window.clearInterval(timer);
	}, []);
	const { summary, prices, error } = data;
	const model = useMemo(() => {
		if (!summary || error) return null;
		const groups = new Map<string, SummaryRow[]>();
		const surplus = new Map<string, SurplusDecision>();
		for (const row of summary.rows) {
			const key = decisionKey(row.item.id, row.foundInRaid);
			groups.set(key, [...(groups.get(key) ?? []), row]);
			if (row.category === "surplus" && !surplus.has(row.item.id))
				surplus.set(row.item.id, decideSurplus(prices.prices[row.item.id], prices.states[row.item.id], now));
		}
		const queues = new Map<string, { action: ItemAction; pending: boolean; quantity: number }[]>();
		for (const [key, rows] of groups) {
			groups.set(
				key,
				rows.sort((a, b) => Number(a.category === "surplus") - Number(b.category === "surplus")),
			);
			queues.set(
				key,
				rows.map((row) => {
					const decision = row.category === "keep" ? undefined : surplus.get(row.item.id);
					return { action: decision?.action ?? "KEEP", pending: !!decision?.pending, quantity: row.quantity };
				}),
			);
		}
		const assigned = new Map<ReviewEntry, EntryDecision>();
		const counts = { ALL: 0, KEEP: 0, SELL: 0, HOLD: 0 };
		const values = { SELL: 0, HOLD: 0 };
		for (const entry of entries) {
			if (!entry.itemId) continue;
			const key = decisionKey(entry.itemId, entry.foundInRaid);
			const queue = queues.get(key);
			const head = queue?.find((unit) => unit.quantity > 0);
			if (!queue || !head) continue;
			assigned.set(entry, { key, action: head.action, pending: head.pending });
			counts.ALL++;
			counts[head.action]++;
			let left = entry.quantity;
			for (const unit of queue) {
				const taken = Math.min(unit.quantity, left);
				unit.quantity -= taken;
				left -= taken;
				if (unit.action !== "KEEP") values[unit.action] += taken * (unitSellValue(prices.prices[entry.itemId]) ?? 0);
			}
		}
		return { groups, surplus, assigned, counts, values };
	}, [summary, error, prices.prices, prices.states, now, entries]);
	const activeKey = selected && model?.groups.has(selected) ? selected : null;
	return {
		groups: model?.groups ?? new Map<string, SummaryRow[]>(),
		surplusFor: (itemId: string) => model?.surplus.get(itemId),
		decisionFor: (entry: ReviewEntry) => model?.assigned.get(entry),
		counts: model?.counts ?? { ALL: 0, KEEP: 0, SELL: 0, HOLD: 0 },
		values: model?.values ?? { SELL: 0, HOLD: 0 },
		loading: !summary && !error,
		filter,
		setFilter,
		activeKey,
		select: setSelected,
	};
}
