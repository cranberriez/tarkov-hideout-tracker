import type { Client } from "@libsql/client";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import type {
    ItemAcquisitionTreeData,
    ItemRelationsPayload,
    ItemUsageData,
} from "@/types/contracts";
import { getTursoClient } from "./client";
import { TursoRecordNotFoundError } from "./errors";
import { getActiveDataReleaseId } from "./release-config";
import { parseStoredJson } from "./stored-json";
import { getCurrentPriceData } from "./price-data";
import type { ItemSummary } from "@/types/items";

interface ItemViewPayloads {
    relations: ItemRelationsPayload;
    usage: ItemUsageData;
    acquisition: ItemAcquisitionTreeData;
}

export type ItemViewType = keyof ItemViewPayloads;

export async function getItemView<ViewType extends ItemViewType>(
    mode: TarkovJsonGameMode,
    itemId: string,
    viewType: ViewType,
    database: Client = getTursoClient(),
): Promise<ItemViewPayloads[ViewType]> {
    const releaseId = getActiveDataReleaseId(mode);
    const result = await database.execute({
        sql: `
            SELECT view.payload_json
            FROM item_views AS view
            INNER JOIN data_releases AS release
                ON release.mode = view.mode
                AND release.release_id = view.release_id
                AND release.status = 'ready'
            WHERE view.mode = ?
                AND view.release_id = ?
                AND view.item_id = ?
                AND view.view_type = ?
            LIMIT 1
        `,
        args: [mode, releaseId, itemId, viewType],
    });
    const row = result.rows[0];
    if (!row) {
        throw new TursoRecordNotFoundError(
            `No ${viewType} view exists for ${mode}/${releaseId}/${itemId}`,
        );
    }

    const payload = parseStoredJson<ItemViewPayloads[ViewType]>(
        row.payload_json,
        `${viewType} view for ${itemId}`,
    );
    const items = viewType === "relations"
        ? [
              ...((payload as ItemRelationsPayload).item
                  ? [(payload as ItemRelationsPayload).item as ItemSummary]
                  : []),
              ...(payload as ItemRelationsPayload).relatedItems,
          ]
        : (payload as ItemUsageData | ItemAcquisitionTreeData).items;
    const priceResult = await getCurrentPriceData(
        mode,
        items.map((item) => item.id),
        database,
    );
    const hydrate = (item: ItemSummary): ItemSummary => ({
        ...item,
        marketPrice: priceResult.data[item.id] ?? null,
    });
    if (viewType === "relations") {
        const relations = payload as ItemRelationsPayload;
        return {
            ...relations,
            item: relations.item ? hydrate(relations.item) : null,
            relatedItems: relations.relatedItems.map(hydrate),
            freshness: {
                ...relations.freshness,
                pricesUpdatedAt: priceResult.updatedAt,
            },
        } as ItemViewPayloads[ViewType];
    }
    const recipePayload = payload as ItemUsageData | ItemAcquisitionTreeData;
    return {
        ...recipePayload,
        items: recipePayload.items.map(hydrate),
        freshness: {
            ...recipePayload.freshness,
            pricesUpdatedAt: priceResult.updatedAt,
        },
    } as ItemViewPayloads[ViewType];
}

export function getItemRelationsView(mode: TarkovJsonGameMode, itemId: string) {
    return getItemView(mode, itemId, "relations");
}

export function getItemUsageView(mode: TarkovJsonGameMode, itemId: string) {
    return getItemView(mode, itemId, "usage");
}

export function getItemAcquisitionView(mode: TarkovJsonGameMode, itemId: string) {
    return getItemView(mode, itemId, "acquisition");
}
