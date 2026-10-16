import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { DEV_QUEST_FIXTURES } from "./dev-quest-fixture";
import { questDetailQueryOptions, type QuestDetailData } from "../../lib/query/quest-details";
import type { TarkovJsonGameMode } from "../../lib/game-mode";

const jiti = createJiti(import.meta.url, { alias: { "@": fileURLToPath(new URL("../../", import.meta.url)) } });
const { useQuestDetails } = await jiti.import<typeof import("./useQuestDetails")>("./useQuestDetails");

for (const mode of ["regular", "pve", "pvp-season"] as const) {
	test(`selected quest SSR reads the ${mode} route cache before profile hydration`, () => {
		const client = new QueryClient();
		const quest = DEV_QUEST_FIXTURES[0];
		const data: QuestDetailData = {
			quest,
			items: [],
			unresolvedItemIds: [],
			error: null,
			itemsError: null,
		};
		client.setQueryData(questDetailQueryOptions(mode, quest.id).queryKey, data);
		function SelectedQuest({ routeMode }: { routeMode: TarkovJsonGameMode }) {
			const result = useQuestDetails([quest.id], true, null, routeMode);
			return createElement("h1", null, result.quests[0]?.name ?? "Loading quest details…");
		}
		try {
			const html = renderToString(
				createElement(
					QueryClientProvider,
					{ client },
					createElement(
						SearchParamsContext.Provider,
						{ value: new URLSearchParams() },
						createElement(SelectedQuest, { routeMode: mode }),
					),
				),
			);
			assert.ok(html.includes(quest.name));
			assert.equal(client.getQueryCache().getAll().length, 1, "must not create a default-mode detail cache entry");
		} finally {
			client.clear();
		}
	});
}
