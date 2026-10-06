"use client";
import { createContext, useContext } from "react";
import type { PriceCalculationContext } from "@/lib/price-calculation";
import type { ProfitPageData } from "@/types/contracts";
import type { LockChipNames } from "../utils/lock-summary";

export const ProfitPricingContext = createContext<
	Pick<
		PriceCalculationContext,
		| "playerLevel"
		| "useTraderSaleForLockedOutputs"
		| "stationLevels"
		| "hideoutManagementSkillLevel"
		| "traderLoyaltyLevels"
	> & {
		taskUnlocksById?: ProfitPageData["taskUnlocksById"];
		lockChipNames?: LockChipNames;
		/** Flea level already explained by the profile banner. */
		coveredFleaLevel?: number;
	}
>({});
export const useProfitPricingContext = () => useContext(ProfitPricingContext);
