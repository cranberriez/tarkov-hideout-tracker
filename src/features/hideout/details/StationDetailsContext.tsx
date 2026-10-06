"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Station } from "@/types/hideout";

/** A specific level, or every level above the saved one. */
export type LevelSelection = number | "remaining";

export interface StationDetailsContextValue {
	station: Station;
	/** Every station in the mode (the page's station alone if the list failed); power math reads other stations' bonuses. */
	stations: Station[];
	currentLevel: number;
}

const StationDetailsContext = createContext<StationDetailsContextValue | null>(null);

/** Lets server-streamed slots (crafts) read the client page's station and saved level. */
export function StationDetailsProvider({ value, children }: { value: StationDetailsContextValue; children: ReactNode }) {
	return <StationDetailsContext.Provider value={value}>{children}</StationDetailsContext.Provider>;
}

export function useStationDetails(): StationDetailsContextValue {
	const value = useContext(StationDetailsContext);
	if (!value) throw new Error("useStationDetails must be used inside StationDetailsProvider");
	return value;
}
