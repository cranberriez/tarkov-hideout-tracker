"use client";
// A basic context provider for data allowing data to be initially passed as a prop to initialize

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import type { DataResponseDiagnostics, Station, GlobalItem } from "@/types";

export interface DataContextValue {
    stations: Station[] | null;
    stationsUpdatedAt: number | null;
    stationsError: string | null;
    stationsDiagnostics: DataResponseDiagnostics | null;
    items: GlobalItem[] | null;
    itemById: Readonly<Record<string, GlobalItem>>;
    itemsUpdatedAt: number | null;
    itemsError: string | null;
    itemsDiagnostics: DataResponseDiagnostics | null;
}

const DataContext = createContext<DataContextValue | null>(null);

interface DataProviderProps {
    value: Omit<DataContextValue, "itemById">;
    children: ReactNode;
}

export function DataProvider({ value, children }: DataProviderProps) {
    const itemById = useMemo(
        () => Object.fromEntries((value.items ?? []).map((item) => [item.id, item])),
        [value.items],
    );
    const contextValue = useMemo(
        () => ({ ...value, itemById }),
        [value, itemById],
    );

    return <DataContext.Provider value={contextValue}>{children}</DataContext.Provider>;
}

export function useDataContext(): DataContextValue {
    const ctx = useContext(DataContext);
    if (!ctx) {
        throw new Error("useDataContext must be used within DataLayout DataContext.Provider");
    }
    return ctx;
}
