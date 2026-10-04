import type { TarkovJsonGameMode } from "../game-mode";
import type { ItemSummary } from "../../types/items";
import type { FullQuest } from "../../types/quests";
import type { Trader } from "../../types/traders";
import { prepareQuestDataForMode } from "../quests/quest-preparation";
import { excludeRemovedQuests } from "../quests/removed-quests";
import { validateSearchManifest } from "./manifest";
import { standardItemImageUrl } from "../utils/item-images";

export function buildSearchManifest(
	mode: TarkovJsonGameMode,
	items: ItemSummary[],
	quests: FullQuest[],
	traders: Trader[],
) {
	return validateSearchManifest(
		{
			v: 1,
			mode,
			items: items.map((item) => ({
				id: item.id,
				nn: item.normalizedName,
				n: item.name,
				...(item.shortName ? { sn: item.shortName } : {}),
				// Standard icon URLs are derived from the ID on the client.
				...(item.iconLink && item.iconLink !== standardItemImageUrl(item.id, "icon") ? { ic: item.iconLink } : {}),
			})),
			quests: excludeRemovedQuests(prepareQuestDataForMode(quests, mode)).map((quest) => ({
				id: quest.id,
				nn: quest.normalizedName,
				n: quest.name,
				ti: quest.trader.id,
			})),
			traders: Object.fromEntries(
				traders.map((trader) => [trader.id, { n: trader.name, ...(trader.imageLink ? { ic: trader.imageLink } : {}) }]),
			),
		},
		mode,
	);
}
