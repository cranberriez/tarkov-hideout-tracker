const QUEST_TRADER_ORDER = [
    "Prapor",
    "Therapist",
    "Fence",
    "Skier",
    "Peacekeeper",
    "Mechanic",
    "Ragman",
    "Jaeger",
    "Ref",
    "Lightkeeper",
    "BTR Driver",
] as const;

const QUEST_TRADER_ORDER_INDEX = new Map(
    QUEST_TRADER_ORDER.map((name, index) => [name.toLowerCase(), index]),
);

export function compareQuestTradersByOrder(aName: string, bName: string) {
    const aIndex = QUEST_TRADER_ORDER_INDEX.get(aName.toLowerCase());
    const bIndex = QUEST_TRADER_ORDER_INDEX.get(bName.toLowerCase());

    if (aIndex != null && bIndex != null) return aIndex - bIndex;
    if (aIndex != null) return -1;
    if (bIndex != null) return 1;
    return aName.localeCompare(bName);
}
