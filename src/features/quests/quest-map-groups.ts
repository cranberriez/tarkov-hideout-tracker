import type { FullQuest } from "@/types";

export const NO_QUEST_MAP_GROUP_KEY = "__no-map";

export interface QuestMapGroup {
    key: string;
    name: string;
    aliases: string[];
}

function normalizeMapValue(value: string) {
    return value.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

export function getQuestMapGroupKey(value: string) {
    const normalized = normalizeMapValue(value);
    const compact = normalized.replace(/[^a-z0-9]/g, "");

    if (normalized.includes("ground-zero") || compact.includes("groundzero")) {
        return "ground-zero";
    }

    if (normalized.includes("factory") || compact.includes("factory")) {
        return "factory";
    }

    return normalized;
}

export function getQuestMapGroup(map: FullQuest["map"]): QuestMapGroup {
    if (!map) {
        return { key: NO_QUEST_MAP_GROUP_KEY, name: "Any Map", aliases: [] };
    }

    const normalizedNameKey = getQuestMapGroupKey(map.normalizedName);
    const displayNameKey = getQuestMapGroupKey(map.name);

    if (normalizedNameKey === "ground-zero" || displayNameKey === "ground-zero") {
        return { key: "ground-zero", name: "Ground Zero", aliases: [map.normalizedName] };
    }

    if (normalizedNameKey === "factory" || displayNameKey === "factory") {
        return { key: "factory", name: "Factory", aliases: [map.normalizedName] };
    }

    return { key: normalizedNameKey, name: map.name, aliases: [map.normalizedName] };
}

export function buildQuestMapGroups(quests: FullQuest[], includeNoMap = false) {
    const groups = new Map<string, QuestMapGroup>();

    for (const quest of quests) {
        if (!quest.map && !includeNoMap) continue;

        const group = getQuestMapGroup(quest.map ?? null);
        const existing = groups.get(group.key);

        if (!existing) {
            groups.set(group.key, group);
            continue;
        }

        for (const alias of group.aliases) {
            if (!existing.aliases.includes(alias)) existing.aliases.push(alias);
        }
    }

    return [...groups.values()].sort((a, b) => {
        if (a.key === NO_QUEST_MAP_GROUP_KEY) return 1;
        if (b.key === NO_QUEST_MAP_GROUP_KEY) return -1;
        return a.name.localeCompare(b.name);
    });
}
