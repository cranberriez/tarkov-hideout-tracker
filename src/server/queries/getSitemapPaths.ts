import { DEFAULT_TARKOV_JSON_GAME_MODE } from "../../lib/game-mode";
import { questHref, stationHref } from "../../lib/entity-routes";
import { prepareQuestDataForMode } from "../../lib/quests/quest-preparation";
import { prepareQuestsForDisplay } from "../../lib/quests/removed-quests";
import { SHOW_REMOVED_QUESTS } from "../../features/quests/quest-feature-flags";
import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";

/** Match cookie-free visitors. Never advertise mode-only IDs that would 404 for a crawler. */
export async function getSitemapPaths(repository: TarkovDataRepository): Promise<string[]> {
	const mode = DEFAULT_TARKOV_JSON_GAME_MODE;
	const [quests, stations] = await Promise.all([
		repository.quests.getAll(mode),
		repository.hideout.getStations(mode),
	]);
	// Let read failures propagate instead of publishing a truncated successful sitemap.
	const visibleQuests = prepareQuestsForDisplay(prepareQuestDataForMode(quests.data, mode), SHOW_REMOVED_QUESTS);
	return [...new Set([
		"/hideout", "/quests", "/items", "/items/kappa-checklist",
		...visibleQuests.map((quest) => questHref(quest.id)),
		...stations.data.map((station) => stationHref(station.id)),
	])];
}
