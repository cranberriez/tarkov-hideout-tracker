import type { ReactNode } from "react";
import { getCachedAllMarketPrices } from "@/server/services/marketPrices";
import { PriceDataProvider, type PriceDataContextValue } from "@/app/(data)/_priceDataContext";

interface PriceDataLayoutProps {
    children: ReactNode;
}

export default async function PriceDataLayout({ children }: PriceDataLayoutProps) {
    let marketPricesByMode: PriceDataContextValue["marketPricesByMode"] = {
        PVP: { prices: {}, updatedAt: null },
        PVE: { prices: {}, updatedAt: null },
    };

    const [pvpPricesResponse, pvePricesResponse] = await Promise.all([
        getCachedAllMarketPrices("PVP"),
        getCachedAllMarketPrices("PVE"),
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

    const value: PriceDataContextValue = {
        marketPricesByMode,
        loading: false,
    };

    return <PriceDataProvider value={value}>{children}</PriceDataProvider>;
}
