"use client";
// A basic context provider for data allowing data to be initially passed as a prop to initialize

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { Station, ItemDetails } from "@/types";

export interface DataContextValue {
    stations: Station[] | null;
    stationsUpdatedAt: number | null;
    items: ItemDetails[] | null;
    itemsUpdatedAt: number | null;
}

const DataContext = createContext<DataContextValue | null>(null);

interface DataProviderProps {
    value: DataContextValue;
    children: ReactNode;
}

export function DataProvider({ value, children }: DataProviderProps) {
    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDataContext(): DataContextValue {
    const ctx = useContext(DataContext);
    if (!ctx) {
        throw new Error("useDataContext must be used within DataLayout DataContext.Provider");
    }
    return ctx;
}
