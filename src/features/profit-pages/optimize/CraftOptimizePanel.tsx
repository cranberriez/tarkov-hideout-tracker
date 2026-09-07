"use client";

import { Clock3, Link2, Sparkles, ArrowUpRight, Eye } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { RecipeCalculatorInput } from "@/lib/price-calculation/types";
import type { ProfitStationSource } from "../types";
import { type CraftRanking } from "./craft-plans";
import { buildContinuousSession, buildCraftSession, getCraftPlans, recommendCraftPlans, selectStationPlans, toggleStationPlan } from "./craft-plans";
import { CraftRecommendations } from "./CraftRecommendations";
import { CraftPlanDetails } from "./CraftPlanDetails";

const button = "inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-40";

export function CraftOptimizePanel({
	input,
	stations,
	traders,
	onItemOpen,
}: {
	input: RecipeCalculatorInput;
	stations: Record<string, ProfitStationSource>;
	traders: Record<string, { name: string }>;
	onItemOpen: (id: string) => void;
}) {
	const [compact, setCompact] = useState(false);
	const [targetMinutes, setTargetMinutes] = useState(240);
	const continuous = targetMinutes === 0;
	const [ranking, setRanking] = useState<CraftRanking>("profit-hour");
	const [includeChains, setIncludeChains] = useState(true);
	const [sources, setSources] = useState({ traders: true, barters: true });
	const [demo, setDemo] = useState(false);
	const [choices, setChoices] = useState<Record<string, string[]>>({});
	const [detailId, setDetailId] = useState<string | null>(null);
	const planInput = useMemo(() => {
		if (!demo) return input;
		// Preview uses real catalog/prices with hypothetical unlocks; never writes player state.
		const levels: Record<string, number> = {};
		const quests: Record<string, boolean> = {};
		for (const craft of input.crafts) {
			levels[craft.stationId] = Math.max(levels[craft.stationId] ?? 0, craft.level);
			if (craft.taskUnlockId) quests[craft.taskUnlockId] = true;
		}
		const traderLevels: Record<string, number> = {};
		for (const offer of [...input.barters, ...Object.values(input.itemsById).flatMap((item) => item.buyFromTrader ?? [])]) {
			traderLevels[offer.traderId] = Math.max(traderLevels[offer.traderId] ?? 0, offer.minTraderLevel);
			if (offer.taskUnlockId) quests[offer.taskUnlockId] = true;
		}
		return { ...input, playerLevel: 60, stationLevels: levels, traderLoyaltyLevels: traderLevels, completedQuests: quests };
	}, [input, demo]);
	const { plans, excluded } = useMemo(() => getCraftPlans(planInput, includeChains, sources), [planInput, includeChains, sources]);
	const groups = useMemo(
		() => recommendCraftPlans(plans, continuous ? "profit-hour" : ranking, targetMinutes * 60),
		[plans, ranking, targetMinutes, continuous],
	);
	const stationIds = useMemo(
		() =>
			[...new Set(input.crafts.map((craft) => craft.stationId))]
				.filter((id) => (planInput.stationLevels?.[id] ?? 0) > 0)
				.sort((a, b) => (stations[a]?.name ?? a).localeCompare(stations[b]?.name ?? b)),
		[input.crafts, planInput.stationLevels, stations],
	);
	const slots = (input.craftingSkillLevel ?? 0) >= 51 ? 2 : 1;
	const selected = useMemo(
		() => stationIds.flatMap((id) => selectStationPlans(groups.get(id) ?? [], choices[id], slots)),
		[stationIds, groups, choices, slots],
	);
	const session = useMemo(() => buildCraftSession(selected, slots), [selected, slots]);
	const duration = Math.max(0, ...session.map((booking) => booking.finish));
	const readyAt = Object.fromEntries(
		selected.map((plan) => [plan.id, Math.max(0, ...session.filter((booking) => booking.planId === plan.id).map((booking) => booking.finish))]),
	);
	const repeated = useMemo(() => (continuous ? buildContinuousSession(selected, slots) : null), [continuous, selected, slots]);
	const firstSession = repeated ? repeated.bookings.filter((booking) => booking.round === 0) : session;
	const continuousRates = repeated ? Object.fromEntries(selected.map((plan) => [plan.id, (plan.profit * (repeated.counts[plan.id] ?? 0)) / 24])) : undefined;
	const cadence = Math.max(duration, targetMinutes * 60);
	const detail = plans.find((plan) => plan.id === detailId) ?? null;

	function resetChoices() {
		setChoices({});
	}

	return (
		<section aria-label="Craft planner" className="space-y-6">
			<header className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h1 className="flex items-center gap-2 text-2xl font-semibold">
						<Sparkles size={19} className="text-tarkov-green" aria-hidden="true" />
						Craft planner
					</h1>
					<p className="mt-1 text-sm text-muted-foreground">What to craft, based on when you play.</p>
				</div>
				<div className="flex flex-wrap items-center gap-2 self-center" aria-label="Planner actions">
					<div aria-label="Craft card view" className="flex gap-1">
						{([false, true] as const).map((value) => (
							<button
								key={String(value)}
								type="button"
								aria-pressed={compact === value}
								onClick={() => setCompact(value)}
								className={`rounded-lg px-3 py-2 text-xs ${compact === value ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5"}`}
							>
								{value ? "Compact" : "Expanded"}
							</button>
						))}
					</div>
					<Link
						href="/items/crafting-profits"
						className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-xs hover:bg-white/10"
					>
						Compare crafts
						<ArrowUpRight size={14} aria-hidden="true" />
					</Link>
					<button
						type="button"
						aria-pressed={demo}
						className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${demo ? "border-amber-300/40 bg-amber-300/10 text-amber-200" : "border-white/15 bg-white/[0.03] text-muted-foreground hover:bg-white/10 hover:text-foreground"}`}
						onClick={() => {
							setDemo((value) => !value);
							resetChoices();
						}}
					>
						<Eye size={14} aria-hidden="true" />
						{demo ? "Use my profile" : "Preview all unlocks"}
					</button>
				</div>
			</header>
			{demo && (
				<p role="status" className="rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-xs text-amber-200">
					Preview · all crafts unlocked. Your profile is unchanged.
				</p>
			)}
			<div className="flex flex-wrap items-center gap-4 rounded-xl bg-white/[0.025] p-3 sm:p-4">
				<div className="flex flex-wrap items-center gap-2" aria-label="Return time">
					<span className="mr-1 flex items-center gap-1.5 text-sm text-muted-foreground">
						<Clock3 size={15} aria-hidden="true" />
						Back in
					</span>
					{[0, 40, 120, 240, 480].map((minutes) => (
						<button
							type="button"
							key={minutes}
							aria-pressed={targetMinutes === minutes}
							onClick={() => {
								setTargetMinutes(minutes);
								resetChoices();
							}}
							className={`rounded-lg px-3 py-2 text-sm ${targetMinutes === minutes ? "bg-tarkov-green/20 text-tarkov-green ring-1 ring-tarkov-green/50" : "text-muted-foreground hover:bg-white/5"}`}
						>
							{minutes === 0 ? "Continuous" : minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
						</button>
					))}
					<label className="flex items-center gap-1 text-xs text-muted-foreground">
						<input
							aria-label="Return time in minutes"
							type="number"
							min={0}
							max={1440}
							key={targetMinutes}
							defaultValue={targetMinutes}
							onKeyDown={(event) => {
								if (event.key === "Enter") event.currentTarget.blur();
							}}
							onBlur={(event) => {
								const value = Number(event.target.value);
								if (Number.isFinite(value) && event.target.value.trim() !== "" && value >= 0 && value <= 1440) {
									setTargetMinutes(Math.round(value));
									resetChoices();
									event.target.value = String(Math.round(value));
								} else event.target.value = String(targetMinutes);
							}}
							className="w-16 rounded-lg border border-white/10 bg-tarkov-surface px-2 py-2 text-foreground"
						/>
						min
					</label>
				</div>
				<div className="flex flex-wrap items-center gap-4 sm:ml-auto">
					<label className="flex items-center gap-2 text-xs text-muted-foreground">
						<Link2 size={14} aria-hidden="true" />
						<input
							type="checkbox"
							checked={includeChains}
							onChange={(event) => {
								setIncludeChains(event.target.checked);
								resetChoices();
							}}
						/>
						Craft inputs
					</label>
					{(
						[
							["traders", "Traders"],
							["barters", "Barters"],
						] as const
					).map(([key, label]) => (
						<label key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
							<input
								type="checkbox"
								checked={sources[key]}
								onChange={(event) => {
									setSources((previous) => ({ ...previous, [key]: event.target.checked }));
									resetChoices();
								}}
							/>
							{label}
						</label>
					))}
					{!continuous && (
						<div className="flex flex-wrap gap-1 rounded-lg bg-black/20 p-1" aria-label="Rank crafts by">
							{(
								[
									["profit-hour", "Profit"],
									["target", "Time fit"],
									["duration", "Longest"],
								] as const
							).map(([value, label]) => (
								<button
									key={value}
									type="button"
									aria-pressed={ranking === value}
									onClick={() => {
										setRanking(value);
										resetChoices();
									}}
									className={`rounded-md px-3 py-2 text-xs ${ranking === value ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
								>
									{label}
								</button>
							))}
						</div>
					)}
				</div>
			</div>
			{!stationIds.length && (
				<div role="status" className="rounded-xl border border-dashed border-white/15 px-5 py-10 text-center">
					<p className="text-sm text-muted-foreground">Set your station levels to get started.</p>
					<button
						type="button"
						className={`${button} mt-4`}
						onClick={() => {
							setDemo(true);
							resetChoices();
						}}
					>
						Preview crafts
					</button>
				</div>
			)}
			<p className="text-xs text-muted-foreground">
				{slots === 2 ? "Elite · pick two crafts per station. A new pick replaces the oldest." : "Pick one craft per station."}{" "}
				{continuous ? "Best estimated profit/hour · restart as soon as each chain finishes." : "Hourly estimates include waiting until your next run."}
			</p>
			<CraftRecommendations
				compact={compact}
				groups={groups}
				stationIds={stationIds}
				stations={stations}
				items={input.itemsById}
				selected={selected}
				slots={slots}
				target={targetMinutes * 60}
				cadence={cadence}
				readyAt={
					continuous
						? Object.fromEntries(
								selected.map((plan) => [
									plan.id,
									Math.max(0, ...firstSession.filter((booking) => booking.planId === plan.id).map((booking) => booking.finish)),
								]),
							)
						: readyAt
				}
				continuousRates={continuousRates}
				onSelect={(id, planId) => {
					setChoices((previous) => ({
						...previous,
						[id]: toggleStationPlan(
							selectStationPlans(groups.get(id) ?? [], previous[id], slots).map((plan) => plan.id),
							planId,
							slots,
						),
					}));
				}}
				onInspect={setDetailId}
			/>
			{repeated?.truncated && (
				<p role="status" className="text-xs text-amber-200">
					Calculation limit reached. Hourly estimates cover only calculated batches.
				</p>
			)}
			<div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
				<p>Estimates before fuel, flea fees and tool setup. Batch leftovers are not valued. Trader stock and restock limits are not modeled.</p>
				<p>
					{excluded} unavailable or unprofitable recipes hidden.{" "}
					{continuous
						? "Chains repeat independently as station slots free up. Shared stations can cause waits; this is an estimate, not a proven optimum."
						: "Runs restart after all selected crafts finish, no sooner than your return time."}{" "}
					Chains need extra check-ins.
				</p>
			</div>
			<CraftPlanDetails
				key={detailId}
				plan={detail}
				items={input.itemsById}
				stations={stations}
				traders={traders}
				slots={slots}
				bookings={firstSession}
				continuousRate={continuousRates?.[detailId ?? ""]}
				target={targetMinutes * 60}
				cadence={cadence}
				onClose={() => setDetailId(null)}
				onItemOpen={onItemOpen}
			/>
		</section>
	);
}
