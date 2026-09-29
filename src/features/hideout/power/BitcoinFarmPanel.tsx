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
import { bitcoinFarmFigures, secondsUntilFull } from "./bitcoin-farm-model";
import { GpuSlotGrid } from "./GpuSlotGrid";
import { stationSlots } from "./hideout-power-model";
import { formatRoubles, formatSpan, useNow } from "./power-format";
import { Countdown, StationPowerRow } from "./StationPowerRow";
import { useHideoutPower } from "./useHideoutPower";

function Stat({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
	return (
		<div className="flex min-w-0 flex-col gap-1.5">
			<span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
			<span className="font-mono text-xl font-semibold leading-tight text-foreground">{children}</span>
			{hint && <span className="text-[11px] leading-snug text-muted-foreground">{hint}</span>}
		</div>
	);
}

function formatDays(hours: number | null) {
	if (hours === null) return "—";
	return hours >= 48 ? `${Math.round(hours / 24)} days` : formatSpan(hours * 3600);
}

/**
 * Bitcoin Farm station page: Generator row, then the calculator. Installed cards,
 * stored coins and progress are page-local and never persisted.
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
	const fullSeconds = figures
		? secondsUntilFull({ secondsPerBitcoin: figures.secondsPerBitcoin, stored, progress: progress / 100 })
		: null;

	let body: ReactNode;
	if (currentLevel < 1) {
		body = <DataNotice tone="empty">Build the Bitcoin Farm to install graphics cards.</DataNotice>;
	} else if (slots === null) {
		body = <DataNotice>Graphics card slot data is unavailable for this station.</DataNotice>;
	} else {
		body = (
			<>
				<div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
					<GpuSlotGrid key={`${mode}:${slots}`} slots={slots} count={gpus} onChange={setGpus}>
						{figures && (
							<div className="mt-1 flex flex-col gap-2 text-xs text-muted-foreground">
								<div className="flex flex-wrap items-center gap-2">
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
								</div>
								{fullSeconds !== null &&
									(fullSeconds > 0 ? (
										<Countdown label={`Full (${BITCOIN_STORAGE_CAP} BTC) in`} seconds={fullSeconds} now={now} />
									) : (
										<span className="text-warning">Full: production has stopped until you collect.</span>
									))}
							</div>
						)}
					</GpuSlotGrid>
					<div className="flex items-center gap-3 rounded-lg bg-warning/5 px-4 py-3 lg:min-w-44">
						{power.bitcoin.item && (
							<ItemImage
								item={{
									...power.bitcoin.item,
									iconLink:
										power.bitcoin.item.image512pxLink ??
										power.bitcoin.item.gridImageLink ??
										power.bitcoin.item.iconLink ??
										power.bitcoin.item.baseImageLink,
								}}
								size={40}
								opensModal
							/>
						)}
						<div className="flex flex-col gap-1">
							<span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
								Bitcoin value
							</span>
							<span className="font-mono text-xl font-semibold leading-tight text-foreground">
								{loading ? "…" : formatRoubles(power.bitcoin.price)}
							</span>
							{(loading || power.bitcoin.price === null) && (
								<span className="text-[11px] text-muted-foreground">
									{loading ? "Loading trader offers…" : "Trader offer unavailable"}
								</span>
							)}
						</div>
					</div>
				</div>
				{power.missingItemIds.length > 0 && (
					<DataNotice>
						{power.missingItemIds.length} Bitcoin Farm item{power.missingItemIds.length === 1 ? " is" : "s are"} missing
						from the price data and cannot be valued.
					</DataNotice>
				)}
				{power.pricing === "unavailable" && power.unavailableReason && (
					<DataNotice>{power.unavailableReason}</DataNotice>
				)}
				<div className="grid grid-cols-2 gap-x-6 gap-y-5 px-1 py-2 sm:grid-cols-4">
					<Stat label="Time per Bitcoin">{figures ? formatSpan(figures.secondsPerBitcoin) : "—"}</Stat>
					<Stat label="Bitcoin / day">{figures ? figures.bitcoinPerDay.toFixed(3) : "—"}</Stat>
					<Stat label="Revenue / hour" hint="Fuel cost not deducted">
						{loading ? "…" : formatRoubles(figures?.grossPerHour ?? null)}
					</Stat>
					<Stat label="GPU payback" hint="Installed cards · excludes fuel">
						{loading ? "…" : formatDays(figures?.roiHours ?? null)}
					</Stat>
				</div>
			</>
		);
	}

	return (
		<>
			<StationPowerRow power={power} />
			<WikiSection title="Bitcoin Farm" bodyClassName="flex flex-col gap-4">
				{body}
			</WikiSection>
		</>
	);
}
