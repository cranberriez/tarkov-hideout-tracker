import { BITCOIN_GPU_BOOST, BITCOIN_STORAGE_CAP } from "../../../lib/cfg/hideout-power";

/** Seconds to produce one coin; each card beyond the first adds a flat boost. */
export function secondsPerBitcoin(gpus: number, baseDuration: number): number | null {
	if (gpus < 1 || baseDuration <= 0) return null;
	return baseDuration / (1 + (gpus - 1) * BITCOIN_GPU_BOOST);
}

export interface BitcoinFarmFigures {
	gpus: number;
	secondsPerBitcoin: number;
	bitcoinPerDay: number;
	/** Bitcoin sale value per hour; fuel is not subtracted. */
	grossPerHour: number | null;
	gpuInvestment: number | null;
	/** Hours of gross revenue to recover the GPU investment. */
	roiHours: number | null;
	/** Hours for one additional card to pay for itself; constant beyond the first card. */
	marginalGpuPaybackHours: number | null;
}

export function bitcoinFarmFigures({
	gpus,
	baseDuration,
	bitcoinPrice,
	gpuPrice,
}: {
	gpus: number;
	baseDuration: number;
	bitcoinPrice: number | null;
	gpuPrice: number | null;
}): BitcoinFarmFigures | null {
	const seconds = secondsPerBitcoin(gpus, baseDuration);
	if (seconds === null) return null;
	const grossPerHour = bitcoinPrice === null ? null : (3600 / seconds) * bitcoinPrice;
	const gpuInvestment = gpuPrice === null ? null : gpus * gpuPrice;
	const marginalPerHour = bitcoinPrice === null ? null : BITCOIN_GPU_BOOST * (3600 / baseDuration) * bitcoinPrice;
	return {
		gpus,
		secondsPerBitcoin: seconds,
		bitcoinPerDay: 86_400 / seconds,
		grossPerHour,
		gpuInvestment,
		roiHours: gpuInvestment !== null && grossPerHour ? gpuInvestment / grossPerHour : null,
		marginalGpuPaybackHours: gpuPrice !== null && marginalPerHour ? gpuPrice / marginalPerHour : null,
	};
}

/** Seconds until the farm holds the storage cap; `progress` is the current coin's completion (0–1). */
export function secondsUntilFull({
	secondsPerBitcoin: seconds,
	stored,
	progress,
}: {
	secondsPerBitcoin: number;
	stored: number;
	progress: number;
}): number {
	const coins = Math.min(BITCOIN_STORAGE_CAP, Math.max(0, Math.trunc(stored)));
	const done = coins >= BITCOIN_STORAGE_CAP ? 0 : Math.min(1, Math.max(0, progress));
	return Math.max(0, BITCOIN_STORAGE_CAP - coins - done) * seconds;
}

/** The earlier of the farm filling up and the generator running dry; both stop production. */
export function comeBackBy(
	fullSeconds: number | null,
	powerSeconds: number | null,
): { seconds: number; reason: "full" | "power" } | null {
	if (fullSeconds === null && powerSeconds === null) return null;
	if (powerSeconds === null || (fullSeconds !== null && fullSeconds <= powerSeconds)) {
		return { seconds: fullSeconds!, reason: "full" };
	}
	return { seconds: powerSeconds, reason: "power" };
}
