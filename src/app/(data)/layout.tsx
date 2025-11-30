import type { ReactNode } from "react";
import { getCachedHideoutStations } from "@/server/services/hideout";
import { getCachedHideoutRequiredItems } from "@/server/services/items";
import { getCachedMarketPrices } from "@/server/services/marketPrices";
import { DataProvider, type DataContextValue } from "@/app/(data)/_dataContext";
import { QuickAddModal } from "@/features/quick-add/QuickAddModal";

interface DataLayoutProps {
    children: ReactNode;
}

export default async function DataLayout({ children }: DataLayoutProps) {
    const [stationsResponse, itemsResponse] = await Promise.all([
        getCachedHideoutStations(),
        getCachedHideoutRequiredItems(),
    ]);

    const items = itemsResponse.data.items;
    const normalizedNames = items
        .map((item) => item.normalizedName)
        .filter((name) => typeof name === "string" && name.trim().length > 0);

    const [pvpPricesResponse, pvePricesResponse] = normalizedNames.length
        ? await Promise.all([
              getCachedMarketPrices(normalizedNames, "PVP"),
              getCachedMarketPrices(normalizedNames, "PVE"),
          ])
        : [
              { data: {}, updatedAt: Date.now() },
              { data: {}, updatedAt: Date.now() },
          ];

    const marketPricesByMode: DataContextValue["marketPricesByMode"] = {
        PVP: {
            prices: pvpPricesResponse.data,
            updatedAt: pvpPricesResponse.updatedAt,
        },
        PVE: {
            prices: pvePricesResponse.data,
            updatedAt: pvePricesResponse.updatedAt,
        },
    };

    const value: DataContextValue = {
        stations: stationsResponse.data.stations,
        stationsUpdatedAt: stationsResponse.updatedAt,
        items,
        itemsUpdatedAt: itemsResponse.updatedAt,
        marketPricesByMode,
    };

    return (
        <DataProvider value={value}>
            {children}
            <QuickAddModal />
        </DataProvider>
    );
}
