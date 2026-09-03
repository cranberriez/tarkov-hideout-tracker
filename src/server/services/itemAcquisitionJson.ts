import { fetchTarkovJsonData, type TarkovJsonGameMode } from "@/server/services/tarkovJson/client";
import type { BarterRecord, CraftRecord, ItemAmountRef } from "@/types/recipes";
import type { BartersPayload, CraftsPayload } from "@/types/contracts";
import type { DataResult } from "@/types/common";

interface JsonContainedItem {
    item?: unknown;
    count?: unknown;
    attributes?: { tool?: unknown };
}
interface JsonBarter {
    id?: unknown; trader?: unknown; taskUnlock?: unknown; requiredItems?: unknown;
    minTraderLevel?: unknown; offeredItem?: JsonContainedItem; buyLimit?: unknown;
}
interface JsonCraft {
    id?: unknown; station?: unknown; level?: unknown; duration?: unknown;
    taskUnlock?: unknown; requiredItems?: unknown; requiredQuestItems?: unknown;
    gameEditions?: unknown; productItem?: JsonContainedItem;
}
function positiveNumber(value: unknown, fallback: number) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function mapItemRefs(value: unknown): ItemAmountRef[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry: JsonContainedItem) => {
        if (!entry || typeof entry.item !== "string" || !entry.item) return [];
        return [{
            itemId: entry.item,
            count: positiveNumber(entry.count, 1),
            ...(entry.attributes?.tool === true ? { isTool: true } : {}),
        }];
    });
}

function mapBarter(value: JsonBarter): BarterRecord | null {
    if (
        typeof value.id !== "string" || !value.id ||
        typeof value.trader !== "string" || !value.trader ||
        typeof value.offeredItem?.item !== "string" || !value.offeredItem.item
    ) return null;
    return {
        id: value.id,
        offeredItemId: value.offeredItem.item,
        offeredCount: positiveNumber(value.offeredItem.count, 1),
        traderId: value.trader,
        minTraderLevel: positiveNumber(value.minTraderLevel, 1),
        ...(typeof value.taskUnlock === "string" && value.taskUnlock
            ? { taskUnlockId: value.taskUnlock } : {}),
        requiredItems: mapItemRefs(value.requiredItems),
        buyLimit: value.buyLimit === null
            ? null
            : typeof value.buyLimit === "number" && Number.isFinite(value.buyLimit)
                ? value.buyLimit : undefined,
    };
}

function mapCraft(value: JsonCraft): CraftRecord | null {
    if (
        typeof value.id !== "string" || !value.id ||
        typeof value.station !== "string" || !value.station ||
        typeof value.productItem?.item !== "string" || !value.productItem.item
    ) return null;
    return {
        id: value.id,
        productItemId: value.productItem.item,
        productCount: positiveNumber(value.productItem.count, 1),
        stationId: value.station,
        level: positiveNumber(value.level, 1),
        duration: positiveNumber(value.duration, 0),
        ...(typeof value.taskUnlock === "string" && value.taskUnlock
            ? { taskUnlockId: value.taskUnlock } : {}),
        requiredItems: mapItemRefs(value.requiredItems),
        requiredQuestItems: mapItemRefs(value.requiredQuestItems),
        gameEditions: Array.isArray(value.gameEditions)
            ? value.gameEditions.filter((edition): edition is string => typeof edition === "string")
            : [],
    };
}

function indexBy<T>(records: T[], key: (record: T) => string): Record<string, T[]> {
    const result: Record<string, T[]> = Object.create(null) as Record<string, T[]>;
    for (const record of records) (result[key(record)] ??= []).push(record);
    return result;
}

export async function getBarterIndex(
    gameMode: TarkovJsonGameMode = "regular",
): Promise<DataResult<BartersPayload>> {
    const raw = await fetchTarkovJsonData<JsonBarter[]>("barters", gameMode);
    const barters = raw.flatMap((value) => {
        const record = mapBarter(value);
        return record ? [record] : [];
    });
    if (barters.length === 0) {
        throw new Error("Tarkov JSON barter mapping produced no records");
    }
    return {
        data: { bartersByItemId: indexBy(barters, (record) => record.offeredItemId) },
        updatedAt: Date.now(),
        diagnostics: { provider: "json", upstreamStatus: "ok" },
    };
}

export async function getCraftIndex(
    gameMode: TarkovJsonGameMode = "regular",
): Promise<DataResult<CraftsPayload>> {
    const raw = await fetchTarkovJsonData<JsonCraft[]>("crafts", gameMode);
    const crafts = raw.flatMap((value) => {
        const record = mapCraft(value);
        return record ? [record] : [];
    });
    if (crafts.length === 0) {
        throw new Error("Tarkov JSON craft mapping produced no records");
    }
    return {
        data: { craftsByItemId: indexBy(crafts, (record) => record.productItemId) },
        updatedAt: Date.now(),
        diagnostics: { provider: "json", upstreamStatus: "ok" },
    };
}
