import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { getBarterIndex, getCraftIndex } from "./itemAcquisitionJson";
import { getCachedTraders } from "./tarkovData";
import type { BarterRecord, CraftRecord, Trader } from "@/types";

export interface ProfitPageData {
    barters: BarterRecord[];
    crafts: CraftRecord[];
    traders: Trader[];
    bartersUpdatedAt: number | null;
    craftsUpdatedAt: number | null;
    bartersError: string | null;
    craftsError: string | null;
}

export async function getProfitPageData(
    gameMode: TarkovJsonGameMode,
): Promise<ProfitPageData> {
    const [bartersResult, craftsResult, tradersResult] = await Promise.allSettled([
        getBarterIndex(gameMode),
        getCraftIndex(gameMode),
        getCachedTraders(gameMode),
    ]);

    return {
        barters:
            bartersResult.status === "fulfilled"
                ? Object.values(bartersResult.value.data.bartersByItemId).flat()
                : [],
        crafts:
            craftsResult.status === "fulfilled"
                ? Object.values(craftsResult.value.data.craftsByItemId).flat()
                : [],
        traders:
            tradersResult.status === "fulfilled"
                ? tradersResult.value.data.traders
                : [],
        bartersUpdatedAt:
            bartersResult.status === "fulfilled" ? bartersResult.value.updatedAt : null,
        craftsUpdatedAt:
            craftsResult.status === "fulfilled" ? craftsResult.value.updatedAt : null,
        bartersError:
            bartersResult.status === "rejected" ? "Barter data could not be loaded." : null,
        craftsError:
            craftsResult.status === "rejected" ? "Craft data could not be loaded." : null,
    };
}
