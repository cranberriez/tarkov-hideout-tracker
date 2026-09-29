"use client";

import type { ReactNode } from "react";
import { ItemLink } from "@/components/entities/item-link";
import { ItemThumbnail } from "@/components/entities/item-thumbnail";
import { DataNotice } from "@/components/ui/data-notice";
import { SEASONAL_CONFIG } from "@/lib/cfg/seasonal";
import { BITCOIN_BASE_DURATION_SECONDS, GRAPHICS_CARD_ITEM_ID } from "@/lib/cfg/hideout-power";
import { toTarkovJsonGameMode, type TarkovJsonGameMode } from "@/lib/game-mode";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { ProfitPageData } from "@/types/contracts";
import type { ItemSummary } from "@/types/items";
import { WikiSection } from "../details/components/WikiSection";
import { useStationDetails } from "../details/StationDetailsContext";
import { bitcoinFarmFigures, remainingProfit } from "./bitcoin-farm-model";
import { GpuCountControl, GpuSlotColumns } from "./GpuSlots";
import { stationSlots } from "./hideout-power-model";
import { formatRoubles, formatSignedRoubles, formatSpan, useNow } from "./power-format";
import { StationPowerRow } from "./StationPowerRow";
import { useBitcoinFarmCards } from "./useBitcoinFarmCards";
import { useHideoutPower, type FuelTank } from "./useHideoutPower";

function Stat({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
	return (
		<div className="flex min-w-0 flex-col gap-1">
			<span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
			<span className="font-mono text-base font-semibold leading-tight text-foreground">{children}</span>
			{hint && <span className="text-[11px] leading-snug text-muted-foreground">{hint}</span>}
		</div>
	);
}

function ItemValue({
	label,
	item,
	price,
	loading,
}: {
	label: string;
	item: ItemSummary | undefined;
	price: number | null;
	loading: boolean;
}) {
	const content = (
		<>
			{item && (
				<ItemThumbnail
					item={{ ...item, iconLink: item.image512pxLink ?? item.gridImageLink ?? item.iconLink ?? item.baseImageLink }}
					size={28}
				/>
			)}
			<Stat label={label} hint={loading ? "Loading…" : price === null ? "Unavailable" : undefined}>
				{loading ? "…" : formatRoubles(price)}
			</Stat>
		</>
	);
	if (!item) return <div className="flex items-center gap-2 px-2 py-1.5">{content}</div>;
	return (
		<ItemLink
			item={item}
			aria-label={`${item.name}, ${loading ? "loading price" : formatRoubles(price)}`}
			className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-highlight/5 focus-visible:outline-2 focus-visible:outline-brand"
		>
			{content}
		</ItemLink>
	);
}

function DetailRow({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
	return (
		<div className="flex items-baseline justify-between gap-3 border-b border-highlight/5 py-1.5 text-xs">
			<dt className="min-w-0 text-muted-foreground">
				{label}
				{hint && <span className="ml-1.5 text-[11px] text-subtle-foreground">{hint}</span>}
			</dt>
			<dd className="shrink-0 font-mono font-semibold text-foreground">{children}</dd>
		</div>
	);
}

function formatDays(days: number | null) {
	if (days === null) return "—";
	return days < 1 ? formatSpan(days * 86_400) : `${days < 10 ? days.toFixed(1) : Math.round(days)} days`;
}

/**
 * Bitcoin Farm station page: Generator row, then the calculator. The installed card
 * count is saved per profile in its own key, outside the user store.
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
	const gameMode = useUserStore((state) => state.gameMode);
	const [gpuInput, setGpus] = useBitcoinFarmCards(gameMode);
	const slots = stationSlots(station, currentLevel, GRAPHICS_CARD_ITEM_ID);
	const gpus = Math.min(gpuInput, slots ?? 0);
	const loading = power.pricing === "loading";
	const figures = bitcoinFarmFigures({
		gpus,
		baseDuration: BITCOIN_BASE_DURATION_SECONDS,
		bitcoinPrice: power.bitcoin.price,
		gpuPrice: power.gpu.price,
	});
	const profitPerDay = figures?.grossPerHour == null ? null : figures.grossPerHour * 24;
	const profitableAfterDays = figures?.roiHours == null ? null : figures.roiHours / 24;
	const seasonal = mode === toTarkovJsonGameMode(SEASONAL_CONFIG.mode);
	const remaining =
		figures && now !== null
			? remainingProfit(figures.grossPerHour, figures.gpuInvestment, (SEASONAL_CONFIG.endsAt - now) / 1000)
			: null;

	const fullFarm = slots
		? bitcoinFarmFigures({
				gpus: slots,
				baseDuration: BITCOIN_BASE_DURATION_SECONDS,
				bitcoinPrice: power.bitcoin.price,
				gpuPrice: power.gpu.price,
			})
		: null;
	const fuelTank = power.tanks
		.filter((tank) => tank.costPerHour !== null)
		.reduce<FuelTank | undefined>(
			(best, tank) => (best && best.costPerHour! <= tank.costPerHour! ? best : tank),
			undefined,
		);
	const fuelPerDay = fuelTank ? fuelTank.costPerHour! * 24 : null;
	const netPerDay = profitPerDay === null || fuelPerDay === null ? null : profitPerDay - fuelPerDay;
	const money = (value: number | null) => (loading ? "…" : formatRoubles(value));
	const daysLeft = now === null ? null : Math.max(0, Math.ceil((SEASONAL_CONFIG.endsAt - now) / 86_400_000));

	let body: ReactNode;
	if (currentLevel < 1) {
		body = <DataNotice tone="empty">Build the Bitcoin Farm to install graphics cards.</DataNotice>;
	} else if (slots === null) {
		body = <DataNotice>Graphics card slot data is unavailable for this station.</DataNotice>;
	} else {
		body = (
			<>
				<div className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-lg bg-shadow/20 px-4 py-3">
					<div className="flex min-w-0 basis-full items-center gap-x-6 md:min-w-72 md:flex-1 md:basis-0">
						<GpuCountControl key={`${mode}:${slots}`} slots={slots} count={gpus} onChange={setGpus} />
						<GpuSlotColumns slots={slots} count={gpus} />
					</div>
					<div className="flex flex-wrap md:ml-auto gap-x-6 gap-y-3">
						<Stat label="Time to produce 1 BTC">{figures ? formatSpan(figures.secondsPerBitcoin) : "—"}</Stat>
						<Stat label="BTC / day">{figures ? figures.bitcoinPerDay.toFixed(3) : "—"}</Stat>
						<Stat label="Est. profit / day">{loading ? "…" : formatRoubles(profitPerDay)}</Stat>
						<Stat label="Profitable after">{loading ? "…" : formatDays(profitableAfterDays)}</Stat>
						<Stat label="Graphics cards cost">{loading ? "…" : formatRoubles(figures?.gpuInvestment ?? null)}</Stat>
					</div>
				</div>
				<dl className="grid gap-x-8 sm:grid-cols-2">
					<DetailRow label="Fuel cost / day" hint={fuelTank ? `cheapest: ${fuelTank.item?.name}` : undefined}>
						{money(fuelPerDay)}
					</DetailRow>
					<DetailRow label="Profit / day after fuel">{loading ? "…" : formatSignedRoubles(netPerDay)}</DetailRow>
					<DetailRow label="Next card pays back in">
						{loading
							? "…"
							: formatDays(figures?.marginalGpuPaybackHours == null ? null : figures.marginalGpuPaybackHours / 24)}
					</DetailRow>
					<DetailRow label={`Profit / day at ${slots} cards`}>
						{money(fullFarm?.grossPerHour == null ? null : fullFarm.grossPerHour * 24)}
					</DetailRow>
					{seasonal && (
						<>
							<DetailRow label="Remaining profit" hint="until season end">
								{loading ? "…" : formatSignedRoubles(remaining)}
							</DetailRow>
							<DetailRow label={SEASONAL_CONFIG.name} hint={daysLeft === null ? undefined : `${daysLeft} days left`}>
								{new Date(SEASONAL_CONFIG.endsAt).toLocaleDateString(undefined, {
									year: "numeric",
									month: "short",
									day: "numeric",
								})}
							</DetailRow>
						</>
					)}
				</dl>
				{power.missingItemIds.length > 0 && (
					<DataNotice>
						{power.missingItemIds.length} Bitcoin Farm item{power.missingItemIds.length === 1 ? " is" : "s are"} missing
						from the price data and cannot be valued.
					</DataNotice>
				)}
				{power.pricing === "unavailable" && power.unavailableReason && (
					<DataNotice>{power.unavailableReason}</DataNotice>
				)}
			</>
		);
	}

	return (
		<>
			<StationPowerRow power={power} />
			<WikiSection
				title="Bitcoin Farm"
				actions={
					<div className="-my-1.5 flex flex-wrap justify-end gap-x-2">
						<ItemValue label="Bitcoin" item={power.bitcoin.item} price={power.bitcoin.price} loading={loading} />
						<ItemValue label="Graphics card" item={power.gpu.item} price={power.gpu.price} loading={loading} />
					</div>
				}
				bodyClassName="flex flex-col gap-4"
			>
				{body}
			</WikiSection>
		</>
	);
}
