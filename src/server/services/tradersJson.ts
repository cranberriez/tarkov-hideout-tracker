import {
    fetchTarkovJsonDataset,
    type TarkovJsonGameMode,
} from "@/server/services/tarkovJson/client";
import type { DataResult } from "@/types/common";
import type { Trader } from "@/types/traders";
import type { TradersPayload } from "@/types/contracts";

interface JsonTrader {
    id: string;
    name: string;
    normalizedName: string;
    imageLink?: string | null;
    image4xLink?: string | null;
}

export async function getJsonTraders(
    gameMode: TarkovJsonGameMode = "regular",
): Promise<DataResult<TradersPayload>> {
    const dataset = await fetchTarkovJsonDataset<Record<string, JsonTrader>>(
        "traders",
        gameMode,
    );
    const traders: Trader[] = Object.values(dataset.data).map((trader) => ({
        id: trader.id,
        name: dataset.translate(trader.name),
        normalizedName: trader.normalizedName,
        imageLink: trader.imageLink,
        image4xLink: trader.image4xLink,
    }));
    if (traders.length === 0) {
        throw new Error("Tarkov JSON response contained no traders");
    }

    return {
        data: { traders },
        updatedAt: Date.now(),
        diagnostics: { provider: "json", upstreamStatus: "ok" },
    };
}
