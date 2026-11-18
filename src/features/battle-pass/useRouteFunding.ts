import { useMemo } from "react";
import { optimizeRouteFunding, type FundingClaim } from "./lib/funding-model";

export function useRouteFunding(claims: FundingClaim[], startingTarCoins: number, allowSpecial: boolean) {
	return useMemo(() => {
		try {
			return optimizeRouteFunding(claims, startingTarCoins, allowSpecial);
		} catch {
			return "Could not calculate a purchase schedule. Change the balance or offer setting to try again.";
		}
	}, [claims, startingTarCoins, allowSpecial]);
}
