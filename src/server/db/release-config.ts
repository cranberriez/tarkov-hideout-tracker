import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { TursoConfigurationError } from "./errors";

/**
 * Runtime reads are pinned to an immutable uploaded release. Change these IDs
 * after a new release has been generated, uploaded, and validated.
 */
export const ACTIVE_DATA_RELEASE_IDS = {
    regular: "20260904T211847Z",
    pve: "20260904T211847Z",
    "pvp-season": "20260904T211847Z",
} as const satisfies Record<TarkovJsonGameMode, string>;

export function getActiveDataReleaseId(mode: TarkovJsonGameMode): string {
    const releaseId = ACTIVE_DATA_RELEASE_IDS[mode]?.trim();
    if (!releaseId) {
        throw new TursoConfigurationError(
            `No Turso data release is configured for ${mode}`,
        );
    }
    return releaseId;
}
