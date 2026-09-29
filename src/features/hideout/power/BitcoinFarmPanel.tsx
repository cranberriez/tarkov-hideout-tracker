"use client";

import { useState, type ReactNode } from "react";
import { ItemImage } from "@/components/entities/item-image";
import { DataNotice } from "@/components/ui/data-notice";
import { FilterNumberInput } from "@/components/ui/FilterNumberInput";
import { BITCOIN_BASE_DURATION_SECONDS, BITCOIN_STORAGE_CAP, GRAPHICS_CARD_ITEM_ID } from "@/lib/cfg/hideout-power";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import type { ProfitPageData } from "@/types/contracts";
import { WikiSection } from "../details/components/WikiSection";
import { useStationDetails } from "../details/StationDetailsContext";
import { bitcoinFarmFigures, comeBackBy, secondsUntilFull } from "./bitcoin-farm-model";
import { GpuSlotGrid } from "./GpuSlotGrid";
import { stationSlots } from "./hideout-power-model";
import { formatRoubles, formatSpan, useNow } from "./power-format";
import { Countdown, powerOutSeconds, StationPowerRow } from "./StationPowerRow";
import { useHideoutPower } from "./useHideoutPower";

function Stat({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
	return (
		<div className="flex min-w-0 flex-col gap-1 rounded-sm border border-highlight/8 bg-shadow/20 px-3 py-2">
			<span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
			<span className="font-mono text-sm font-semibold leading-none text-foreground">{children}</span>
			{hint && <span className="text-[11px] leading-snug text-muted-foreground">{hint}</span>}
		</div>
	);
}

function formatDays(hours: number | null) {
	if (hours === null) return "—";
	return hours >= 48 ? `${Math.round(hours / 24)} days` : formatSpan(hours * 3600);
}

/**
 * Bitcoin Farm station page: Power row, then the calculator. Installed cards, generator
 * fuel, stored coins and progress are page-local and never persisted.
 */
export function BitcoinFarmPanel({
	mode,
	fallbackData,
}: {
	mode: TarkovJsonGameMode;
	fallbackData: ProfitPageData | null;
}) {
	const { station, stations, currentLevel } = useStationDetails();
	const power = useHideoutPower(mode, fallbackData, stations);
	const now = useNow();
	const [gpuInput, setGpus] = useState(0);
	const [fuelUnits, setFuelUnits] = useState(0);
	const [stored, setStored] = useState(0);
	const [progress, setProgress] = useState(0);
	const slots = stationSlots(station, currentLevel, GRAPHICS_CARD_ITEM_ID);
	const gpus = Math.min(gpuInput, slots ?? 0);
	const loading = power.pricing === "loading";
	const figures = bitcoinFarmFigures({
		gpus,
		baseDuration: BITCOIN_BASE_DURATION_SECONDS,
		bitcoinPrice: power.bitcoin.price,
		gpuPrice: power.gpu.price,
	});
	// Conservative: compare revenue with the pricier tank's hourly cost.
	const fuelPerHour = power.tanks.reduce<number | null>(
		(highest, tank) => (tank.costPerHour === null ? highest : Math.max(highest ?? 0, tank.costPerHour)),
		null,
	);
	const fullSeconds = figures
		? secondsUntilFull({ secondsPerBitcoin: figures.secondsPerBitcoin, stored, progress: progress / 100 })
		: null;
	const comeBack = comeBackBy(fullSeconds, powerOutSeconds(fuelUnits, power.fuel));

	let body: ReactNode;
	if (currentLevel < 1) {
		body = <DataNotice tone="empty">Build the Bitcoin Farm to install graphics cards.</DataNotice>;
	} else if (slots === null) {
		body = <DataNotice>Graphics card slot data is unavailable for this station.</DataNotice>;
	} else {
		body = (
			<>
				<GpuSlotGrid slots={slots} count={gpus} onChange={setGpus} />
				{power.missingItemIds.length > 0 && (
					<DataNotice>
						{power.missingItemIds.length} Bitcoin Farm item{power.missingItemIds.length === 1 ? " is" : "s are"} missing
						from the price data and cannot be valued.
					</DataNotice>
				)}
				{power.pricing === "unavailable" && power.unavailableReason && (
					<DataNotice>{power.unavailableReason}</DataNotice>
				)}
				{gpus === 0 ? (
					<DataNotice tone="empty">Install graphics cards to see production, revenue and payback.</DataNotice>
				) : (
					figures && (
						<>
							<div className="grid grid-cols-2 gap-2 md:grid-cols-3">
								<Stat label="Per coin">{formatSpan(figures.secondsPerBitcoin)}</Stat>
								<Stat label="BTC per day">{figures.bitcoinPerDay.toFixed(3)}</Stat>
								<Stat
									label="Revenue / hour"
									hint={<>Fuel {loading ? "…" : formatRoubles(fuelPerHour)}/h, not subtracted</>}
								>
									{loading ? "…" : formatRoubles(figures.grossPerHour)}
								</Stat>
								<Stat label="GPU investment" hint={<>{formatRoubles(power.gpu.price)} each</>}>
									{loading ? "…" : formatRoubles(figures.gpuInvestment)}
								</Stat>
								<Stat label="Return on GPUs">{loading ? "…" : formatDays(figures.roiHours)}</Stat>
								<Stat label="Each extra GPU" hint="Pays for itself in">
									{loading ? "…" : formatDays(figures.marginalGpuPaybackHours)}
								</Stat>
							</div>
							{power.bitcoin.item && (
								<p className="flex items-center gap-2 text-xs text-muted-foreground">
									<ItemImage item={power.bitcoin.item} size={24} opensModal />
									{power.bitcoin.item.name} sells for{" "}
									<span className="font-mono font-semibold text-foreground">
										{loading ? "…" : formatRoubles(power.bitcoin.price)}
									</span>
									{power.bitcoin.source && ` (${power.bitcoin.source})`}
								</p>
							)}
							<div className="flex flex-col gap-2 text-xs text-muted-foreground">
								<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
									<FilterNumberInput
										label="Coins waiting in the farm"
										value={stored}
										onCommit={(value) => setStored(Math.min(BITCOIN_STORAGE_CAP, value))}
										widthClassName="w-6"
										prefix={<span>Stored</span>}
										suffix={<span>/ {BITCOIN_STORAGE_CAP}</span>}
									/>
									<FilterNumberInput
										label="Current coin progress percent"
										value={progress}
										onCommit={(value) => setProgress(Math.min(100, value))}
										widthClassName="w-8"
										prefix={<span>Current coin</span>}
										suffix={<span>%</span>}
									/>
									{fullSeconds !== null &&
										(fullSeconds > 0 ? (
											<Countdown label={`Full (${BITCOIN_STORAGE_CAP} BTC) in`} seconds={fullSeconds} now={now} />
										) : (
											<span className="text-warning">Full: production has stopped until you collect.</span>
										))}
								</div>
								{comeBack && comeBack.seconds > 0 && (
									<p className="text-sm text-foreground">
										<Countdown label="Come back in" seconds={comeBack.seconds} now={now} />
										<span className="text-muted-foreground">
											{" "}
											({comeBack.reason === "power" ? "power runs out" : "farm is full"})
										</span>
									</p>
								)}
							</div>
						</>
					)
				)}
			</>
		);
	}

	return (
		<>
			<StationPowerRow power={power} fuelUnits={fuelUnits} onFuelUnitsChange={setFuelUnits} />
			<WikiSection
				title="Bitcoin Farm"
				description={
					slots !== null && currentLevel > 0
						? `${slots} graphics card slots at level ${currentLevel}. Revenue excludes fuel.`
						: undefined
				}
				bodyClassName="flex flex-col gap-4"
			>
				{body}
			</WikiSection>
		</>
	);
}
