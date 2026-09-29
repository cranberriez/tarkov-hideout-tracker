"use client";

import { DataNotice } from "@/components/ui/data-notice";
import { FilterNumberInput } from "@/components/ui/FilterNumberInput";
import { WikiSection } from "../details/components/WikiSection";
import { FuelTankCards } from "./FuelTankCards";
import { fuelRuntimeHours, type FuelMultiplier, type FuelSource } from "./hideout-power-model";
import { formatClock, formatSpan, useNow } from "./power-format";
import type { HideoutPower } from "./useHideoutPower";

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

/** Seconds until the generator runs dry, or null when no fuel is entered. */
export function powerOutSeconds(fuelUnits: number, fuel: FuelMultiplier) {
	if (fuelUnits <= 0) return null;
	const hours = fuelRuntimeHours(fuelUnits, fuel.unitsPerHour);
	return hours === null ? null : hours * 3600;
}

export function FuelUnitsInput({
	fuelUnits,
	onChange,
	fuel,
}: {
	fuelUnits: number;
	onChange: (units: number) => void;
	fuel: FuelMultiplier;
}) {
	const now = useNow();
	const seconds = powerOutSeconds(fuelUnits, fuel);
	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
			<FilterNumberInput
				label="Fuel units in generator"
				value={fuelUnits}
				onCommit={onChange}
				widthClassName="w-14"
				prefix={<span>Fuel in generator</span>}
				suffix={<span>units</span>}
			/>
			{seconds !== null ? (
				<Countdown label="Power out in" seconds={seconds} now={now} />
			) : (
				<span>Enter the fuel left across your tanks to see when power runs out.</span>
			)}
		</div>
	);
}

/** Compact fuel row for stations that depend on power; the parent owns the fuel-units input. */
export function StationPowerRow({
	power,
	fuelUnits,
	onFuelUnitsChange,
}: {
	power: HideoutPower;
	fuelUnits: number;
	onFuelUnitsChange: (units: number) => void;
}) {
	return (
		<WikiSection
			title="Power"
			description={burnSummary(power.fuel, power.hideoutManagementSkillLevel)}
			bodyClassName="flex flex-col gap-3"
		>
			{power.fuel.bonusDataMissing && (
				<DataNotice>Fuel modifiers (Solar Power, Defective Wall) are unavailable; showing the base burn rate.</DataNotice>
			)}
			{power.pricing === "unavailable" && <DataNotice>{power.unavailableReason}</DataNotice>}
			<FuelTankCards tanks={power.tanks} loading={power.pricing === "loading"} />
			<FuelUnitsInput fuelUnits={fuelUnits} onChange={onFuelUnitsChange} fuel={power.fuel} />
		</WikiSection>
	);
}
