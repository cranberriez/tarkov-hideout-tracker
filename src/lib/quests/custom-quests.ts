import type { TarkovDataMode } from "@/types/common";
import type { FullQuest, FullQuestObjective, QuestMap, QuestPrerequisite } from "@/types/quests";
import customQuestData from "../data/custom-quests.json";

/**
 * Reviewed quest corrections layered over provider data while the provider is
 * out of date. Entries are compact hand-authored definitions expanded into
 * `FullQuest` records here. See docs/quests.md.
 */

interface TraderRef {
	id: string;
	name: string;
	normalizedName: string;
}

const TRADERS: Readonly<Record<string, TraderRef>> = Object.fromEntries(
	(
		[
			["54cb50c76803fa8b248b4571", "Prapor"],
			["54cb57776803fa99248b456e", "Therapist"],
			["579dc571d53a0658a154fbec", "Fence"],
			["58330581ace78e27b8b10cee", "Skier"],
			["5935c25fb3acc3127c3d8cd9", "Peacekeeper"],
			["5a7c2eca46aef81a7ca2145d", "Mechanic"],
			["5ac3b934156ae10c4430e83c", "Ragman"],
			["5c0647fdd443bc2504c2d371", "Jaeger"],
			["638f541a29ffd1183d187f57", "Lightkeeper"],
		] as const
	).map(([id, name]) => [name.toLowerCase(), { id, name, normalizedName: name.toLowerCase() }]),
);

const MAPS: Readonly<Record<string, QuestMap>> = Object.fromEntries(
	(
		[
			["56f40101d2720b2a4d8b45d6", "Customs", "customs"],
			["5714dbc024597771384a510d", "Interchange", "interchange"],
			["5704e4dad2720bb55b8b4567", "Lighthouse", "lighthouse"],
			["5704e5fad2720bc05b8b4567", "Reserve", "reserve"],
			["5704e554d2720bac5b8b456e", "Shoreline", "shoreline"],
			["5714dc692459777137212e12", "Streets of Tarkov", "streets-of-tarkov"],
			["5b0fc42d86f7744a585f9105", "The Lab", "the-lab"],
			["5704e3c2d2720bac5b8b4567", "Woods", "woods"],
		] as const
	).map(([id, name, normalizedName]) => [normalizedName, { id, name, normalizedName }]),
);

export interface CustomObjectiveDef {
	/** `shoot`, `extract`, `plantItem`, `giveItem`, `findItem`, `useItem`, `skill` or `visit`. */
	type: string;
	description: string;
	optional?: boolean;
	count?: number;
	/** Map normalized names. */
	maps?: string[];
	/** shoot: enemy labels. */
	targetNames?: string[];
	/** extract: exit name. */
	exitName?: string;
	/** Item objectives: item IDs. */
	itemIds?: string[];
	foundInRaid?: boolean;
}

export interface CustomQuestDef {
	id: string;
	name: string;
	/** Lowercase trader name. */
	trader?: string;
	/** New quests only: provider quest that must be present, so partial or unrelated quest sets never receive them. */
	anchor?: string;
	/** Where the data was read from. */
	source: string;
	/** Reviewer note, e.g. unmodelled unlock delays. */
	note?: string;
	/** Data modes this applies to; omitted means every mode. */
	modes?: TarkovDataMode[];
	minPlayerLevel?: number;
	experience?: number;
	/** Quest IDs that must be complete. */
	requires?: string[];
	/** Minimum loyalty level per trader. */
	loyaltyLevels?: Record<string, number>;
	lightkeeperRequired?: boolean;
	objectives?: CustomObjectiveDef[];
}

export interface CustomQuestManifest {
	version: number;
	quests: CustomQuestDef[];
}

export const CUSTOM_QUEST_MANIFEST = customQuestData as CustomQuestManifest;

function slug(name: string) {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
}

function expandObjective(questId: string, index: number, def: CustomObjectiveDef): FullQuestObjective {
	const base = {
		id: `${questId}:objective-${index + 1}`,
		description: def.description,
		optional: def.optional ?? false,
		maps: (def.maps ?? []).flatMap((key) => MAPS[key] ?? []),
		locations: [],
		...(def.count === undefined ? {} : { count: def.count }),
	};
	switch (def.type) {
		case "shoot":
			return {
				...base,
				type: "shoot",
				count: def.count ?? 1,
				target: "",
				targetNames: def.targetNames ?? [],
				shotType: "kill",
				bodyParts: [],
				zoneNames: [],
			};
		case "extract":
			return {
				...base,
				type: "extract",
				exitName: def.exitName ?? null,
				exitStatus: ["Survived"],
				zoneNames: [],
			};
		case "plantItem":
		case "giveItem":
		case "findItem":
			return {
				...base,
				type: def.type,
				count: def.count ?? 1,
				foundInRaid: def.foundInRaid ?? false,
				itemIds: def.itemIds ?? [],
			};
		case "useItem":
			return {
				...base,
				type: "useItem",
				useAnyItemIds: def.itemIds ?? [],
				compareMethod: ">=",
				count: def.count ?? 1,
				zoneNames: [],
			};
		default:
			return { ...base, type: def.type };
	}
}

function expandRequirements(def: CustomQuestDef, names: Map<string, string>) {
	const taskRequirements: QuestPrerequisite[] = [];
	for (const id of def.requires ?? []) {
		const name = names.get(id);
		if (!name) return null;
		taskRequirements.push({ task: { id, name }, status: ["complete"] });
	}
	const traderRequirements = Object.entries(def.loyaltyLevels ?? {}).flatMap(([key, value]) => {
		const trader = TRADERS[key];
		return trader
			? [{ id: `${def.id}:loyalty-${key}`, trader, requirementType: "level", compareMethod: ">=", value }]
			: [];
	});
	return { taskRequirements, traderRequirements };
}

/**
 * Overlay reviewed corrections. An entry whose ID matches a provider quest patches
 * only the fields it defines; otherwise it adds a quest, unless the provider now
 * ships a quest with the same name, in which case the provider wins. Entries with
 * an unresolvable prerequisite are skipped, never applied without it.
 */
export function applyCustomQuests(
	quests: FullQuest[],
	mode: TarkovDataMode,
	manifest: CustomQuestManifest = CUSTOM_QUEST_MANIFEST,
): FullQuest[] {
	const defs = manifest.quests.filter((def) => !def.modes || def.modes.includes(mode));
	// An empty provider set means the read failed or is partial; never publish custom data alone.
	if (defs.length === 0 || quests.length === 0) return quests;

	const providerIds = new Set(quests.map((quest) => quest.id));
	const providerNames = new Set(quests.map((quest) => quest.normalizedName));
	const applicable = defs.filter(
		(def) =>
			providerIds.has(def.id) || (!!def.anchor && providerIds.has(def.anchor) && !providerNames.has(slug(def.name))),
	);

	const names = new Map(quests.map((quest) => [quest.id, quest.name]));
	// Partial provider reads (single-quest detail loads) still resolve custom-to-custom prerequisites.
	for (const def of manifest.quests) names.set(def.id, names.get(def.id) ?? def.name);
	for (const def of applicable) names.set(def.id, def.name);

	const patches = new Map<string, FullQuest>();
	const additions: FullQuest[] = [];
	for (const def of applicable) {
		const requirements = expandRequirements(def, names);
		if (!requirements) {
			console.warn(`Custom quest "${def.name}" skipped: unresolved prerequisite.`);
			continue;
		}
		const provider = quests.find((quest) => quest.id === def.id);
		const trader = def.trader ? TRADERS[def.trader] : undefined;
		const fields: Partial<FullQuest> = {
			name: def.name,
			normalizedName: slug(def.name),
			customSource: def.source,
			...(trader ? { trader } : {}),
			...(def.minPlayerLevel === undefined ? {} : { minPlayerLevel: def.minPlayerLevel }),
			...(def.experience === undefined ? {} : { experience: def.experience }),
			...(def.lightkeeperRequired === undefined ? {} : { lightkeeperRequired: def.lightkeeperRequired }),
			...(def.requires ? { taskRequirements: requirements.taskRequirements } : {}),
			...(def.loyaltyLevels ? { traderRequirements: requirements.traderRequirements } : {}),
			...(def.objectives
				? { objectives: def.objectives.map((objective, index) => expandObjective(def.id, index, objective)) }
				: {}),
		};
		if (provider) {
			patches.set(def.id, { ...provider, ...fields });
			continue;
		}
		if (!trader) {
			console.warn(`Custom quest "${def.name}" skipped: unknown trader.`);
			continue;
		}
		additions.push({
			id: def.id,
			experience: 0,
			map: null,
			taskRequirements: [],
			failConditions: [],
			traderRequirements: [],
			otherRequirements: [],
			requiredPrestige: null,
			objectives: [],
			...fields,
		} as FullQuest);
	}

	return [...quests.map((quest) => patches.get(quest.id) ?? quest), ...additions];
}

/**
 * Provider quest IDs a single-quest read must include so a custom-only quest can be
 * prepared: applying it requires its anchor to be present. Empty for provider quests.
 */
export function getCustomQuestAnchorIds(questId: string, mode: TarkovDataMode): string[] {
	const def = CUSTOM_QUEST_MANIFEST.quests.find((entry) => entry.id === questId);
	if (!def?.anchor || (def.modes && !def.modes.includes(mode))) return [];
	return [def.anchor];
}

/** Problems that make a manifest unsafe to ship; used by tests. */
export function validateCustomQuestManifest(manifest: CustomQuestManifest, knownQuestIds: ReadonlySet<string>) {
	const problems: string[] = [];
	const seen = new Set<string>();
	const ownIds = new Set(manifest.quests.map((def) => def.id));
	for (const def of manifest.quests) {
		const label = `${def.name} (${def.id})`;
		if (seen.has(def.id)) problems.push(`${label}: duplicate ID`);
		seen.add(def.id);
		if (!def.source) problems.push(`${label}: missing source`);
		if (!knownQuestIds.has(def.id) && !def.trader) problems.push(`${label}: new quests need a trader`);
		if (!knownQuestIds.has(def.id) && (!def.anchor || !knownQuestIds.has(def.anchor))) {
			problems.push(`${label}: new quests need a known provider anchor`);
		}
		if (def.trader && !TRADERS[def.trader]) problems.push(`${label}: unknown trader "${def.trader}"`);
		for (const id of def.requires ?? []) {
			if (!ownIds.has(id) && !knownQuestIds.has(id)) problems.push(`${label}: unknown prerequisite ${id}`);
		}
		for (const key of Object.keys(def.loyaltyLevels ?? {})) {
			if (!TRADERS[key]) problems.push(`${label}: unknown loyalty trader "${key}"`);
		}
		for (const objective of def.objectives ?? []) {
			for (const map of objective.maps ?? []) {
				if (!MAPS[map]) problems.push(`${label}: unknown map "${map}"`);
			}
		}
	}
	return problems;
}
