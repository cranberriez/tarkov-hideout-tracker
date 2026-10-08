"use client";

import { useMemo } from "react";
import { createDefaultPlayerProfile, useUserStore } from "@/lib/stores/useUserStore";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { useSearchManifest } from "@/lib/search/useSearchManifest";
import { useDemandRequirements } from "../../items/demand/useDemandRequirements";
import { buildItemDemand, type ItemNeed } from "../../items/demand/item-demand-model";
import { GameDataError, GameDataPage, GameLoader } from "../GameDataPage";
import { isPlayableItem, requirementItemIds } from "./do-i-need-it-model";
import { DoINeedItGame } from "./DoINeedItGame";

const TITLE = "Do I Need It?";
const NO_INVENTORY = {};

/**
 * Remaining needs for the active profile (unfinished quests and hideout levels, minus owned copies), reusing
 * the Loot Scanner's demand model. Before setup, a fresh profile without inventory stands in, so the game
 * asks about everything quests and the hideout use.
 */
function DoINeedItData({ mode }: { mode: TarkovJsonGameMode }) {
	const { profile, kappa, query } = useDemandRequirements();
	const personal = useUserStore((state) => state.hasCompletedSetup);
	const owned = useUserStore((state) => state.itemCounts);
	const catalog = useSearchManifest(mode, true);
	const result = useMemo(() => {
		if (!query.data || !catalog.data) return null;
		const items = catalog.data.items;
		const byId = new Map(items.map((item) => [item.id, item]));
		const stacks = [...requirementItemIds(query.data)].flatMap((id) => {
			const item = byId.get(id);
			return item ? [{ item, quantity: 0, foundInRaid: "no" as const }] : [];
		});
		const { needs } = buildItemDemand(
			stacks,
			items,
			query.data,
			personal ? profile : createDefaultPlayerProfile(),
			personal ? owned : NO_INVENTORY,
			undefined,
			kappa,
		);
		const playable = items.filter(isPlayableItem);
		const playableIds = new Set(playable.map((item) => item.id));
		const remaining = new Map<string, ItemNeed>(
			[...needs].filter(([id, need]) => need.remaining > 0 && playableIds.has(id)),
		);
		return { playable, remaining };
	}, [query.data, catalog.data, personal, profile, owned, kappa]);

	const error = query.error ?? catalog.error;
	if (error) return <GameDataError title={TITLE} message={error.message} />;
	if (!result) return <GameLoader title={TITLE} />;
	return <DoINeedItGame catalog={result.playable} needs={result.remaining} personal={personal} />;
}

export function DoINeedItQueryPage({ mode }: { mode: TarkovJsonGameMode }) {
	return (
		<GameDataPage mode={mode} title={TITLE}>
			<DoINeedItData mode={mode} />
		</GameDataPage>
	);
}
