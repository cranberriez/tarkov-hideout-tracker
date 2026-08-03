import type { ReactNode } from "react";
import {
    getCachedHideoutRequiredItems,
    getCachedHideoutStations,
} from "@/server/services/tarkovData";
import { DataProvider, type DataContextValue } from "@/app/(data)/_dataContext";
import PriceDataLayout from "@/app/(data)/PriceDataLayout";
import { QuickAddModal } from "@/features/quick-add/QuickAddModal";

interface DataLayoutProps {
    children: ReactNode;
}

export default async function DataLayout({ children }: DataLayoutProps) {
    const [stationsResponse, itemsResponse] = await Promise.all([
        getCachedHideoutStations(),
        getCachedHideoutRequiredItems(),
    ]);

    const value: DataContextValue = {
        stations: stationsResponse.data.stations,
        stationsUpdatedAt: stationsResponse.updatedAt,
        items: itemsResponse.data.items,
        itemsUpdatedAt: itemsResponse.updatedAt,
    };

    return (
        <DataProvider value={value}>
            <PriceDataLayout>
                {children}
                <QuickAddModal />
            </PriceDataLayout>
        </DataProvider>
    );
}
