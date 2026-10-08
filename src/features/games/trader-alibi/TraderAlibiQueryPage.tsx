"use client";

import { useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { traderAlibiQueryOptions } from "@/lib/query/page-data";
import { useSearchManifest } from "@/lib/search/useSearchManifest";
import { GameDataError, GameDataPage, GameLoader } from "../GameDataPage";
import { buildCluePools } from "./trader-alibi-model";
import { TraderAlibiGame } from "./TraderAlibiGame";

const TITLE = "Trader Alibi";

/** Clues come from the game endpoint; item names and images from the shared search manifest. */
function TraderAlibiData({ mode }: { mode: TarkovJsonGameMode }) {
	const { data } = useSuspenseQuery(traderAlibiQueryOptions(mode));
	const catalog = useSearchManifest(mode, true);
	const pools = useMemo(() => (catalog.data ? buildCluePools(data, catalog.data.items) : null), [data, catalog.data]);
	if (catalog.error) return <GameDataError title={TITLE} message={catalog.error.message} />;
	if (!pools) return <GameLoader title={TITLE} />;
	return <TraderAlibiGame pools={pools} />;
}

export function TraderAlibiQueryPage({ mode }: { mode: TarkovJsonGameMode }) {
	return (
		<GameDataPage mode={mode} title={TITLE}>
			<TraderAlibiData mode={mode} />
		</GameDataPage>
	);
}
