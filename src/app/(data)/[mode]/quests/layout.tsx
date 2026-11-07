import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { RouteLoader } from "@/components/core/RouteLoader";
import { QuestsQueryPage } from "@/features/quests/QuestsQueryPage";
import { readRouteGameMode, type ModeRouteParams } from "@/server/route-game-mode";

export const metadata: Metadata = {
	// A plain string title here would drop the root template for quest routes.
	title: { default: "Quests · Tarkov Hideout Tracker", template: "%s · Tarkov Hideout Tracker" },
	description: "Escape from Tarkov quest log with objectives, requirements, unlocks, and maps.",
};

/** The client-owned workspace persists across quest routes. */
export default async function QuestsLayout({ children, params }: { children: ReactNode; params: ModeRouteParams }) {
	const { dataMode } = await readRouteGameMode(params);
	return (
		<Suspense fallback={<RouteLoader page="quests" title="Quests" />}>
			<QuestsQueryPage mode={dataMode}>{children}</QuestsQueryPage>
		</Suspense>
	);
}
