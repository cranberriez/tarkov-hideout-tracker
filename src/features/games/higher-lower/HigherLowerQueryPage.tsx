"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { higherLowerQueryOptions } from "@/lib/query/page-data";
import { GameDataError, GameDataPage } from "../GameDataPage";
import { HigherLowerGame } from "./HigherLowerGame";

const TITLE = "Higher or Lower";

function HigherLowerData({ mode }: { mode: TarkovJsonGameMode }) {
	const { data } = useSuspenseQuery(higherLowerQueryOptions(mode));
	if (data.error) return <GameDataError title={TITLE} message={data.error} />;
	return <HigherLowerGame items={data.items} />;
}

export function HigherLowerQueryPage({ mode }: { mode: TarkovJsonGameMode }) {
	return (
		<GameDataPage mode={mode} title={TITLE}>
			<HigherLowerData mode={mode} />
		</GameDataPage>
	);
}
