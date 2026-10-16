import type { FullQuest, QuestMapLocation } from "@/types/quests";
import {
	getObjectiveCategory,
	OBJECTIVE_CATEGORY_LABELS,
	OBJECTIVE_CATEGORY_SHORT_LABELS,
	type QuestObjectiveCategory,
} from "../../../quests/workspace/quest-workspace-utils";
import { isLocationOnRaidPlannerMap } from "../../../quests/workspace/raid-planner-maps";
import { tarkovPreset, type LayerDef, type MapMarker, type MarkerPreset, type Vec3 } from "../../tarkov-map";

export const QUEST_LAYER = "quests";

/** An objective type standing for each legend group, for its icon. */
export const CATEGORY_TYPES: Record<QuestObjectiveCategory, string> = {
	"hand-in": "giveItem",
	find: "findItem",
	plant: "plantItem",
	eliminate: "shoot",
	extract: "extract",
	location: "visit",
	build: "buildItem",
	use: "useItem",
	other: "other",
};

const questLayer: LayerDef = {
	key: QUEST_LAYER,
	label: "Quest objectives",
	icon: "quest_objective",
	allFloors: true,
	groups: (Object.keys(OBJECTIVE_CATEGORY_LABELS) as QuestObjectiveCategory[]).map((category) => ({
		key: category,
		label: OBJECTIVE_CATEGORY_LABELS[category],
		// Drawn by the explorer as the objective type's icon; this image is only a fallback.
		icon: "quest_objective",
	})),
};

/** The map library's preset plus one layer of active quest objectives, grouped by objective type. */
export const explorerPreset: MarkerPreset = { ...tarkovPreset, layers: [questLayer, ...tarkovPreset.layers] };

/** The quest layer with only the objective types that have markers on this map. */
export function questLayerFor(layers: LayerDef[], markers: readonly MapMarker[]): LayerDef[] {
	const present = new Set(markers.filter((marker) => marker.layer === QUEST_LAYER).flatMap((marker) => marker.groups));
	return layers.flatMap((layer) => {
		if (layer.key !== QUEST_LAYER) return [layer];
		const groups = layer.groups.filter((group) => present.has(group.key));
		return groups.length ? [{ ...layer, groups }] : [];
	});
}

function centre(outline: readonly Vec3[]): Vec3 {
	const sum = outline.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y, z: total.z + point.z }), {
		x: 0,
		y: 0,
		z: 0,
	});
	return { x: sum.x / outline.length, y: sum.y / outline.length, z: sum.z / outline.length };
}

function locationPosition(location: QuestMapLocation): Vec3 | null {
	if (location.position) return location.position;
	return location.outline.length ? centre(location.outline) : null;
}

/**
 * One marker per positioned location of each quest objective on this map, skipping objectives marked visited.
 * Zone locations carry their outline. Identical spots within one objective collapse into one marker.
 */
export function buildQuestMarkers(
	quests: readonly FullQuest[],
	mapKey: string,
	visited: Readonly<Record<string, Readonly<Record<string, boolean>>>> = {},
): MapMarker[] {
	const markers: MapMarker[] = [];
	for (const quest of quests) {
		for (const objective of quest.objectives) {
			if (visited[quest.id]?.[objective.id]) continue;
			const category = getObjectiveCategory(objective.type);
			const seen = new Set<string>();
			(objective.locations ?? []).forEach((location, index) => {
				if (!isLocationOnRaidPlannerMap(location, mapKey)) return;
				const position = locationPosition(location);
				if (!position) return;
				const key = `${position.x.toFixed(1)}|${position.y.toFixed(1)}|${position.z.toFixed(1)}`;
				if (seen.has(key)) return;
				seen.add(key);
				markers.push({
					id: `quest:${quest.id}:${objective.id}:${index}`,
					layer: QUEST_LAYER,
					groups: [category],
					position,
					...(location.outline.length ? { outline: location.outline } : {}),
					label: quest.name,
					tags: [
						OBJECTIVE_CATEGORY_SHORT_LABELS[category],
						...(location.source === "possibleLocation" ? ["Possible spawn"] : []),
					],
					details: [{ label: "Objective", value: objective.description }],
					quest: { questId: quest.id, objectiveId: objective.id, type: objective.type },
				});
			});
		}
	}
	return markers;
}
