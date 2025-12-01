export interface NeedBreakdown {
    totalRequired: number;
    effectiveHave: number;
    neededTotal: number;
    requiredFir: number;
    haveFirReserved: number;
    neededFir: number;
    neededNonFir: number;
    isSatisfied: boolean;
    usesFirForNonFir: boolean;
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

    const isSatisfied = neededTotal === 0;

    // If we had to dip into leftover FiR to cover non-FiR demand, then
    // some FiR that could be used elsewhere is effectively "borrowed" here.
    const maxNonFirFulfilledWithoutFir = Math.min(reqNonFir, haveNonFir);
    const usedFirForNonFir = reqNonFir - maxNonFirFulfilledWithoutFir;
    const usesFirForNonFir = usedFirForNonFir > 0;

    return {
        totalRequired,
        effectiveHave,
        neededTotal,
        requiredFir: reqFir,
        haveFirReserved: usedFirForFir,
        neededFir,
        neededNonFir,
        isSatisfied,
        usesFirForNonFir,
    };
}
