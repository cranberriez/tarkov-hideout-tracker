import { DEFAULT_GAME_MODE, DEFAULT_TARKOV_JSON_GAME_MODE } from "../../lib/game-mode";
import { modeHref, questHref, stationHref } from "../../lib/entity-routes";
import { prepareQuestDataForMode } from "../../lib/quests/quest-preparation";
import { prepareQuestsForDisplay } from "../../lib/quests/removed-quests";
import { SHOW_REMOVED_QUESTS } from "../../features/quests/quest-feature-flags";
import { STORY_CHAPTERS } from "../../lib/data/story";
import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";

/** The indexed default mode (PVP) only; other modes are `noindex`. Never advertise IDs the route would 404. */
export async function getSitemapPaths(repository: TarkovDataRepository): Promise<string[]> {
	const mode = DEFAULT_TARKOV_JSON_GAME_MODE;
	const [quests, stations] = await Promise.all([
		repository.quests.getAll(mode),
		repository.hideout.getStations(mode),
	]);
	// Let read failures propagate instead of publishing a truncated successful sitemap.
	const visibleQuests = prepareQuestsForDisplay(prepareQuestDataForMode(quests.data, mode), SHOW_REMOVED_QUESTS);
	return [...new Set([
		...["/hideout", "/quests", "/items", "/items/kappa-checklist", "/items/market", "/uploader"].map((path) =>
			modeHref(DEFAULT_GAME_MODE, path),
		),
		"/story",
		...STORY_CHAPTERS.map((chapter) => `/story/${chapter.id}`),
		...visibleQuests.map((quest) => questHref(DEFAULT_GAME_MODE, quest.id)),
		...stations.data.map((station) => stationHref(DEFAULT_GAME_MODE, station.id)),
	])];
}
