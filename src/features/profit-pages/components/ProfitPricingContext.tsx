"use client";
import { createContext, useContext } from "react";
import type { PriceCalculationContext } from "@/lib/price-calculation";
import type { ProfitPageData } from "@/types/contracts";

export const ProfitPricingContext = createContext<
  Pick<PriceCalculationContext, "playerLevel" | "useTraderSaleForLockedOutputs" | "stationLevels" | "hideoutManagementSkillLevel" | "traderLoyaltyLevels"> & {
    taskUnlocksById?: ProfitPageData["taskUnlocksById"];
  }
>({});
export const useProfitPricingContext = () => useContext(ProfitPricingContext);
