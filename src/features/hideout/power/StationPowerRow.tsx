"use client";

import { DataNotice } from "@/components/ui/data-notice";
import { Flame } from "lucide-react";
import { StationImage } from "@/components/entities/station-image";
import { StationLink } from "@/components/entities/station-link";
import { GENERATOR_STATION_ID } from "@/lib/cfg/hideout-power";
import { WikiSection } from "../details/components/WikiSection";
import { useStationDetails } from "../details/StationDetailsContext";
import { FuelTankCards } from "./FuelTankCards";
import { type FuelMultiplier, type FuelSource } from "./hideout-power-model";
import { formatClock, formatSpan } from "./power-format";
import type { HideoutPower } from "./useHideoutPower";
import { PowerSkills } from "./PowerSkills";

export function formatPercent(value: number) {
	const rounded = Math.round(value * 1000) / 10;
	return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${Math.abs(rounded)}%`;
}

/** Per-station totals of built bonuses (e.g. Solar Power −0.5); cancelled totals are omitted. */
export function groupFuelSources(sources: readonly FuelSource[]) {
	const byStation = new Map<string, { name: string; value: number }>();
	for (const source of sources) {
		const entry = byStation.get(source.stationId) ?? { name: source.stationName, value: 0 };
		entry.value += source.value;
		byStation.set(source.stationId, entry);
	}
	return [...byStation.values()].filter((entry) => Math.abs(entry.value) > 1e-9);
}

export function burnSummary(fuel: FuelMultiplier, hideoutManagementSkillLevel: number) {
	const parts = groupFuelSources(fuel.sources).map((entry) => `${entry.name} ${formatPercent(entry.value)}`);
	const skill = Math.min(50, hideoutManagementSkillLevel);
	if (skill > 0) parts.push(`Hideout Management ${skill}`);
	return `Burn ×${fuel.multiplier.toFixed(2)} · ${fuel.unitsPerHour.toFixed(2)} units/h${parts.length ? ` (${parts.join(", ")})` : ""}`;
}

export function Countdown({ label, seconds, now }: { label: string; seconds: number; now: number | null }) {
	return (
		<span>
			{label} <span className="font-mono font-semibold text-foreground">{formatSpan(seconds)}</span>
			{now !== null && <span className="text-muted-foreground"> · {formatClock(now, seconds)}</span>}
		</span>
	);
}

/** Compact generator overview for stations that depend on power. */
export function StationPowerRow({ power }: { power: HideoutPower }) {
	const { station, stations } = useStationDetails();
	const generator = stations.find((station) => station.id === GENERATOR_STATION_ID);
	const level = power.stationLevels[GENERATOR_STATION_ID] ?? 0;
	const solar = stations.find((station) => station.id === "5d494a385b56502f18c98a0c");
	const solarBonus = power.fuel.sources
		.filter((source) => source.stationId === solar?.id)
		.reduce((total, source) => total + source.value, 0);
	return (
		<WikiSection
			title={
				generator && station.id !== generator.id ? (
					<StationLink station={generator}>Generator</StationLink>
				) : (
					"Generator"
				)
			}
			actions={<PowerSkills />}
			bodyClassName="-mt-1 flex flex-col gap-4"
		>
			{power.fuel.bonusDataMissing && (
				<DataNotice>Fuel modifiers unavailable. Burn estimate may be incomplete.</DataNotice>
			)}
			{power.pricing === "unavailable" && <DataNotice>{power.unavailableReason}</DataNotice>}
			<div className="grid items-stretch gap-4 lg:grid-cols-[auto_minmax(0,1fr)] xl:gap-6">
				<div className="flex flex-col justify-center rounded-lg bg-shadow/20 px-3 py-2 text-center">
					<div className="flex items-center justify-center gap-3">
						{generator && <StationImage station={generator} size={48} className="border-0" />}
						<div>
							<p className="mb-1 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
								<Flame size={13} className="text-brand" aria-hidden />
								Fuel burn
							</p>
							<p className="font-mono text-3xl font-semibold tracking-tight text-foreground">
								{power.fuel.unitsPerHour.toFixed(2)}
								<span className="ml-1.5 text-sm font-normal text-muted-foreground">u/h</span>
							</p>
						</div>
					</div>
					<p className="mt-2 text-[11px] text-muted-foreground">
						{level > 0 ? `Level ${level}` : "Not built"} · {(power.fuel.unitsPerHour * 24).toFixed(1)} u/day
					</p>
					{solar && solarBonus < 0 && (
						<div
							className="mt-2 flex items-center justify-center gap-1.5 rounded-full bg-success/10 px-2 py-1 text-[11px] text-success"
							title={`Solar Power: ${Math.round(-solarBonus * 100)}% base fuel reduction applied`}
						>
							<StationImage station={solar} size={16} className="border-0" />
							Solar +{Math.round(-solarBonus * 100)}% efficiency
						</div>
					)}
				</div>
				<FuelTankCards tanks={power.tanks} loading={power.pricing === "loading"} visual />
			</div>
		</WikiSection>
	);
}
