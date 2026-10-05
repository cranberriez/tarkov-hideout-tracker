"use client";

import { useEffect, useState } from "react";
import { decideUploaderRow, type ItemAction } from "./decision-model";
import type { useUploaderSummary } from "./useUploaderSummary";

export const decisionKey = (id: string, fir: string) => `${id}:${fir}`;

export function useUploaderDecisions(data: ReturnType<typeof useUploaderSummary>) {
	const [selected, setSelected] = useState<string | null>(null);
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 60_000);
		return () => window.clearInterval(timer);
	}, []);
	const { summary, prices, error } = data;
	const groups = new Map<string, NonNullable<typeof summary>["rows"]>();
	for (const row of summary?.rows ?? []) {
		const key = decisionKey(row.item.id, row.foundInRaid);
		groups.set(key, [...(groups.get(key) ?? []), row]);
	}
	const decide = (row: NonNullable<typeof summary>["rows"][number]) =>
		decideUploaderRow(
			row,
			prices.prices[row.item.id],
			prices.states[row.item.id],
			summary?.hasPartialChoices ?? true,
			now,
		);
	const actionFor = (key: string): ItemAction => {
		if (error) return "HOLD";
		const actions = (groups.get(key) ?? []).map((row) => decide(row).action);
		return actions.includes("KEEP")
			? "KEEP"
			: actions.length && actions.every((action) => action === "SELL")
				? "SELL"
				: "HOLD";
	};
	const pendingFor = (key: string) =>
		!error && (!summary || (groups.get(key) ?? []).some((row) => decide(row).pending));
	const activeKey = selected && groups.has(selected) ? selected : groups.keys().next().value;
	return { groups, decide, actionFor, pendingFor, activeKey, select: setSelected };
}
