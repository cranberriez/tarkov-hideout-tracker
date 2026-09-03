import type { DataResult, TarkovDataMode } from "@/types/common";
import type { Station } from "@/types/hideout";
import type { ItemSummary } from "@/types/items";
import type { CurrentPrice, PriceHistoryPoint } from "@/types/prices";
import type { FullQuest } from "@/types/quests";
import type { BarterRecord, CraftRecord } from "@/types/recipes";
import type { Trader } from "@/types/traders";

export interface TarkovDataRepository {
    items: {
        getByIds(
            mode: TarkovDataMode,
            ids: readonly string[],
        ): Promise<DataResult<Record<string, ItemSummary>>>;
    };
    hideout: {
        getStations(mode: TarkovDataMode): Promise<DataResult<Station[]>>;
    };
    quests: {
        getAll(mode: TarkovDataMode): Promise<DataResult<FullQuest[]>>;
        getByIds(
            mode: TarkovDataMode,
            ids: readonly string[],
        ): Promise<DataResult<Record<string, FullQuest>>>;
    };
    traders: {
        getAll(mode: TarkovDataMode): Promise<DataResult<Trader[]>>;
        getByIds(
            mode: TarkovDataMode,
            ids: readonly string[],
        ): Promise<DataResult<Record<string, Trader>>>;
    };
    recipes: {
        getBarters(mode: TarkovDataMode): Promise<DataResult<BarterRecord[]>>;
        getCrafts(mode: TarkovDataMode): Promise<DataResult<CraftRecord[]>>;
    };
    prices: {
        getCurrent(
            mode: TarkovDataMode,
            itemIds: readonly string[],
        ): Promise<DataResult<Record<string, CurrentPrice>>>;
        getHistory(
            mode: TarkovDataMode,
            itemId: string,
        ): Promise<DataResult<PriceHistoryPoint[]>>;
    };
}
