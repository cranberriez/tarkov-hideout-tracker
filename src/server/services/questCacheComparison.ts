import type { FullQuest } from "@/types/quests";
import type { DataResult } from "@/types/common";
import {
    canonicalizeSemanticJson,
    semanticJsonEqual,
} from "../../lib/utils/semantic-json";

export interface ChangedQuest {
    id: string;
    name: string;
    changedFields: string[];
    stored: Record<string, unknown>;
    current: Record<string, unknown>;
}

export interface QuestCacheComparison {
    added: Array<{ id: string; name: string }>;
    removed: Array<{ id: string; name: string }>;
    changed: ChangedQuest[];
    unchangedCount: number;
}

function changedTopLevelFields(before: FullQuest, after: FullQuest): string[] {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...keys]
        .filter(
            (key) =>
                !semanticJsonEqual(
                    before[key as keyof FullQuest],
                    after[key as keyof FullQuest],
                ),
        )
        .sort();
}

export function compareFullQuestData(
    stored: DataResult<{ quests: FullQuest[] }>,
    current: DataResult<{ quests: FullQuest[] }>,
): QuestCacheComparison {
    const storedById = new Map(stored.data.quests.map((quest) => [quest.id, quest]));
    const currentById = new Map(current.data.quests.map((quest) => [quest.id, quest]));
    const added: QuestCacheComparison["added"] = [];
    const removed: QuestCacheComparison["removed"] = [];
    const changed: ChangedQuest[] = [];
    let unchangedCount = 0;

    for (const quest of current.data.quests) {
        const previous = storedById.get(quest.id);
        if (!previous) {
            added.push({ id: quest.id, name: quest.name });
            continue;
        }
        const changedFields = changedTopLevelFields(previous, quest);
        if (changedFields.length > 0) {
            changed.push({
                id: quest.id,
                name: quest.name,
                changedFields,
                stored: Object.fromEntries(
                    changedFields.map((field) => [
                        field,
                        canonicalizeSemanticJson(previous[field as keyof FullQuest]),
                    ]),
                ),
                current: Object.fromEntries(
                    changedFields.map((field) => [
                        field,
                        canonicalizeSemanticJson(quest[field as keyof FullQuest]),
                    ]),
                ),
            });
        } else {
            unchangedCount += 1;
        }
    }

    for (const quest of stored.data.quests) {
        if (!currentById.has(quest.id)) removed.push({ id: quest.id, name: quest.name });
    }

    const byName = (a: { name: string }, b: { name: string }) =>
        a.name.localeCompare(b.name);
    added.sort(byName);
    removed.sort(byName);
    changed.sort(byName);

    return { added, removed, changed, unchangedCount };
}
