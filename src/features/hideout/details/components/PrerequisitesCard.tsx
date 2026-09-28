"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { StationImage } from "@/components/entities/station-image";
import { DetailSection } from "@/components/ui/detail-section";
import { stationHref } from "@/lib/entity-routes";
import { cn } from "@/lib/utils";
import type { Station, StationLevel } from "@/types/hideout";
import { findRequiredStation } from "../../station-model";

const rowClassName = "flex items-center gap-2.5 rounded-sm px-1.5 py-1.5 text-sm";

/** Name, required level, and a green check when met. Unmet station levels read red; skills and traders are untracked. */
function PrerequisiteRow({ icon, name, level, met }: { icon: ReactNode; name: string; level: string; met: boolean | null }) {
	return (
		<>
			{icon}
			<span className="min-w-0 flex-1 truncate text-foreground">{name}</span>
			<span className={cn("font-mono text-xs font-semibold", met === false ? "text-danger" : "text-muted-foreground")}>
				{level}
			</span>
			<span className="flex w-3.5 justify-end">
				{met && <Check size={14} aria-label="Met" className="text-success" />}
			</span>
		</>
	);
}

function RemoteIcon({ src, rounded = false }: { src: string | undefined; rounded?: boolean }) {
	return (
		<span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-shadow/40">
			{src && (
				<Image
					src={src}
					alt=""
					width={24}
					height={24}
					className={cn("size-6 object-contain", rounded && "rounded-full object-cover")}
					unoptimized
				/>
			)}
		</span>
	);
}

/** Non-item requirements for the viewed level(s), grouped per level when several are shown. */
export function PrerequisitesCard({
	station,
	levels,
	stations,
	stationLevels,
}: {
	station: Station;
	levels: readonly StationLevel[];
	stations: readonly Station[];
	stationLevels: Readonly<Record<string, number>>;
}) {
	const groups = levels
		.map((level) => ({
			level: level.level,
			rows: [
				...(level.stationLevelRequirements ?? [])
					.filter((requirement) => requirement.station.normalizedName !== station.normalizedName)
					.map((requirement, index) => {
						const required = findRequiredStation(stations, requirement);
						const met = required ? (stationLevels[required.id] ?? 0) >= requirement.level : false;
						const content = (
							<PrerequisiteRow
								icon={required ? <StationImage station={required} size={28} /> : <RemoteIcon src={undefined} />}
								name={required?.name ?? requirement.station.normalizedName.replace(/-/g, " ")}
								level={`L${requirement.level}`}
								met={met}
							/>
						);
						return required ? (
							<li key={`st-${index}`}>
								<Link
									href={stationHref(required.id)}
									className={cn(
										rowClassName,
										"transition-colors hover:bg-highlight/5 focus-visible:outline-2 focus-visible:outline-brand",
									)}
								>
									{content}
								</Link>
							</li>
						) : (
							<li key={`st-${index}`} className={rowClassName}>
								{content}
							</li>
						);
					}),
				...(level.skillRequirements ?? []).map((requirement, index) => (
					<li key={`sk-${index}`} className={rowClassName}>
						<PrerequisiteRow
							icon={<RemoteIcon src={requirement.skill.imageLink} />}
							name={requirement.skill.name}
							level={`L${requirement.level}`}
							met={null}
						/>
					</li>
				)),
				...(level.traderRequirements ?? []).map((requirement, index) => (
					<li key={`tr-${index}`} className={rowClassName}>
						<PrerequisiteRow
							icon={<RemoteIcon src={requirement.trader.imageLink} rounded />}
							name={requirement.trader.name}
							level={`LL${requirement.value}`}
							met={null}
						/>
					</li>
				)),
			],
		}))
		.filter((group) => group.rows.length > 0);
	const grouped = levels.length > 1;
	return (
		<DetailSection className="rounded-md border border-border-color" title="Prerequisites">
			{groups.length === 0 ? (
				<p className="text-xs text-muted-foreground">No station, skill, or trader requirements.</p>
			) : (
				<div className="flex flex-col gap-3">
					{groups.map((group) => (
						<div key={group.level}>
							{grouped && (
								<h4 className="mb-1 px-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
									Level {group.level}
								</h4>
							)}
							<ul className="flex flex-col gap-0.5">{group.rows}</ul>
						</div>
					))}
				</div>
			)}
		</DetailSection>
	);
}
