import { ItemDetails } from "@/types";

export interface NeedBreakdown {
    totalRequired: number;
    effectiveHave: number;
    neededTotal: number;
    requiredFir: number;
    haveFirReserved: number;
    neededFir: number;
    neededNonFir: number;
}

export interface NeedInputs {
    totalRequired: number;
    requiredFir: number;
    haveNonFir: number;
    haveFir: number;
}

export function computeNeeds({
    totalRequired,
    requiredFir,
    haveNonFir,
    haveFir,
}: NeedInputs): NeedBreakdown {
    const reqFir = Math.min(requiredFir, totalRequired);
    const reqNonFir = totalRequired - reqFir;

    const usedFirForFir = Math.min(haveFir, reqFir);
    const remainingFirReq = Math.max(0, reqFir - haveFir);
    const leftoverFir = haveFir - usedFirForFir;

    const poolNonFirCapable = haveNonFir + leftoverFir;
    const remainingNonFirReq = Math.max(0, reqNonFir - poolNonFirCapable);

    const neededFir = remainingFirReq;
    const neededNonFir = remainingNonFirReq;
    const neededTotal = neededFir + neededNonFir;
    const effectiveHave = Math.max(0, totalRequired - neededTotal);

    return {
        totalRequired,
        effectiveHave,
        neededTotal,
        requiredFir: reqFir,
        haveFirReserved: usedFirForFir,
        neededFir,
        neededNonFir,
    };
}
