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

    return parseStoredJson<ItemViewPayloads[ViewType]>(
        row.payload_json,
        `${viewType} view for ${itemId}`,
    );
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
