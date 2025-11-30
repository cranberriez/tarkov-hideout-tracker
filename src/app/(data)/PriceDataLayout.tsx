import type { ReactNode } from "react";
import { getCachedHideoutRequiredItems } from "@/server/services/items";
import { getCachedMarketPrices } from "@/server/services/marketPrices";
import { PriceDataProvider, type PriceDataContextValue } from "@/app/(data)/_priceDataContext";

interface PriceDataLayoutProps {
    children: ReactNode;
}

export default async function PriceDataLayout({ children }: PriceDataLayoutProps) {
    // Reuse cached items to derive normalized names
    const itemsResponse = await getCachedHideoutRequiredItems();
    const items = itemsResponse.data.items;

    const normalizedNames = items
        .map((item) => item.normalizedName)
        .filter((name) => typeof name === "string" && name.trim().length > 0);

    let marketPricesByMode: PriceDataContextValue["marketPricesByMode"] = {
        PVP: { prices: {}, updatedAt: null },
        PVE: { prices: {}, updatedAt: null },
    };

    let loading = true;

    if (normalizedNames.length > 0) {
        const [pvpPricesResponse, pvePricesResponse] = await Promise.all([
            getCachedMarketPrices(normalizedNames, "PVP"),
            getCachedMarketPrices(normalizedNames, "PVE"),
        ]);

        marketPricesByMode = {
            PVP: {
                prices: pvpPricesResponse.data,
                updatedAt: pvpPricesResponse.updatedAt,
            },
            PVE: {
                prices: pvePricesResponse.data,
                updatedAt: pvePricesResponse.updatedAt,
            },
        };

        loading = false;
    } else {
        // If no items, we are technically "done loading" with empty result
        loading = false;
    }

    const value: PriceDataContextValue = {
        marketPricesByMode,
        loading,
    };

    return <PriceDataProvider value={value}>{children}</PriceDataProvider>;
}
