export interface VendorPrice {
    vendor: {
        id?: string;
        name: string;
        normalizedName: string;
        imageLink?: string | null;
    };
    currency?: string;
    price?: number;
    priceRUB: number;
}

export interface CurrentPrice {
    price?: number | null;
    avg24hPrice?: number | null;
    high24hPrice?: number | null;
    low24hPrice?: number | null;
    lastLowPrice?: number | null;
    lastOfferCount?: number | null;
    changeLast48h?: number | null;
    changeLast48hPercent?: number | null;
    diff24h?: number | null;
    updatedAt?: number | null;
    sellFor?: VendorPrice[];
}

export interface PriceHistoryPoint {
    price: number;
    priceMin: number;
    offerCount: number | null;
    timestamp: number;
}
