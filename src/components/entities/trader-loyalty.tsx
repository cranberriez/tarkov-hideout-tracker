"use client";

import { Crown } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { type QuestTraderLoyaltyLevel } from "@/lib/quests/quest-trader-gates";
import { useUserStore } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";

type TraderIdentity = { id: string; name: string; normalizedName: string };

const LOYALTY_LEVELS: QuestTraderLoyaltyLevel[] = [1, 2, 3, 4];
const FENCE_LOYALTY_LEVELS: QuestTraderLoyaltyLevel[] = [1, 4];
const TRADER_ORDER = [
	"prapor",
	"therapist",
	"fence",
	"skier",
	"peacekeeper",
	"mechanic",
	"ragman",
	"jaeger",
	"ref",
	"btr-driver",
	"lightkeeper",
] as const;

export function normalizedTraderKey(trader: Pick<TraderIdentity, "name" | "normalizedName">) {
	return (trader.normalizedName || trader.name)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/** In-game trader order; unknown traders follow alphabetically. */
export function orderTraders<T extends Pick<TraderIdentity, "name" | "normalizedName">>(traders: readonly T[]) {
	return [...traders].sort((left, right) => {
		const leftRank = TRADER_ORDER.indexOf(normalizedTraderKey(left) as (typeof TRADER_ORDER)[number]);
		const rightRank = TRADER_ORDER.indexOf(normalizedTraderKey(right) as (typeof TRADER_ORDER)[number]);
		return (
			(leftRank === -1 ? Number.MAX_SAFE_INTEGER : leftRank) -
				(rightRank === -1 ? Number.MAX_SAFE_INTEGER : rightRank) || left.name.localeCompare(right.name)
		);
	});
}

/** Traders with a player-set loyalty ladder; excludes event/quest-only entries in the catalog. */
export function isLoyaltyTrader(trader: Pick<TraderIdentity, "name" | "normalizedName">) {
	return hasLoyaltyControl(trader) && (TRADER_ORDER as readonly string[]).includes(normalizedTraderKey(trader));
}

/** BTR Driver and Lightkeeper have no player-set loyalty level. */
export function hasLoyaltyControl(trader: Pick<TraderIdentity, "name" | "normalizedName">) {
	const traderKey = normalizedTraderKey(trader);
	return traderKey !== "btr-driver" && traderKey !== "lightkeeper";
}

function LoyaltyLevelMark({ level }: { level: QuestTraderLoyaltyLevel }) {
	return level === 4 ? (
		<Crown size={14} aria-label="Level 4" />
	) : (
		<span className="font-serif text-sm font-bold" aria-label={`Level ${level}`}>
			{["", "I", "II", "III"][level]}
		</span>
	);
}

/** Loyalty level buttons (plus Fence's exact reputation) bound to the active profile. */
export function TraderLoyaltyControl({ trader, className }: { trader: TraderIdentity; className?: string }) {
	const { questTraderLoyaltyLevels, questFenceReputation, setQuestTraderLoyaltyLevel, setQuestFenceReputation } =
		useUserStore(
			useShallow((state) => ({
				questTraderLoyaltyLevels: state.questTraderLoyaltyLevels,
				questFenceReputation: state.questFenceReputation,
				setQuestTraderLoyaltyLevel: state.setQuestTraderLoyaltyLevel,
				setQuestFenceReputation: state.setQuestFenceReputation,
			})),
		);
	const isFence = normalizedTraderKey(trader) === "fence";
	const loyaltyLevels = isFence ? FENCE_LOYALTY_LEVELS : LOYALTY_LEVELS;
	const currentLoyaltyLevel = questTraderLoyaltyLevels[trader.id] ?? 1;
	const [fenceReputationInput, setFenceReputationInput] = useState(String(questFenceReputation));

	return (
		<div className={cn("flex shrink-0 items-center gap-1", className)}>
			{loyaltyLevels.map((level) => (
				<button
					key={level}
					type="button"
					aria-pressed={currentLoyaltyLevel === level}
					aria-label={`${trader.name} loyalty level ${level}`}
					onClick={() => setQuestTraderLoyaltyLevel(trader.id, level)}
					className={cn(
						"flex h-8 w-8 cursor-pointer items-center justify-center border transition-colors hover:border-brand/40 hover:text-foreground",
						currentLoyaltyLevel === level
							? "border-brand/50 bg-brand/12 text-brand"
							: "border-highlight/10 bg-shadow/20 text-subtle-foreground",
					)}
				>
					<LoyaltyLevelMark level={level} />
				</button>
			))}
			{isFence && (
				<label className="ml-1 w-16 max-w-16 flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-subtle-foreground">
					Rep
					<input
						type="number"
						step="0.01"
						aria-label="Fence exact reputation"
						value={fenceReputationInput}
						onChange={(event) => {
							setFenceReputationInput(event.target.value);
							const value = Number(event.target.value);
							if (event.target.value !== "" && Number.isFinite(value)) {
								setQuestFenceReputation(value);
							}
						}}
						onBlur={() => {
							if (fenceReputationInput !== "") return;
							setFenceReputationInput("0");
							setQuestFenceReputation(0);
						}}
						className="h-8 w-full border border-highlight/10 bg-shadow/25 px-2 font-mono text-xs text-foreground outline-none transition-colors focus:border-brand/50"
					/>
				</label>
			)}
		</div>
	);
}
