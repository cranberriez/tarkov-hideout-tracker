"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Check } from "lucide-react";
import { StationImage } from "@/components/entities/station-image";
import { DetailSection } from "@/components/ui/detail-section";
import { stationHref } from "@/lib/entity-routes";
import type { Station } from "@/types/hideout";
import { getStationDependents, type StationDependent } from "../../station-model";

/** Reverse dependencies: icon spans two rows, name on the first, level requirements on the second. */
export function RequiredByList({
	station,
	stations,
	currentLevel,
}: {
	station: Station;
	stations: readonly Station[];
	currentLevel: number;
}) {
	const groups = useMemo(() => {
		const byStation = new Map<string, { station: Station; entries: StationDependent[] }>();
		for (const dependent of getStationDependents(stations, station)) {
			const group = byStation.get(dependent.station.id) ?? { station: dependent.station, entries: [] };
			group.entries.push(dependent);
			byStation.set(dependent.station.id, group);
		}
		return [...byStation.values()];
	}, [station, stations]);

	return (
		<DetailSection className="rounded-md border border-border-color" title="Required by">
			{groups.length > 0 ? (
				<ul className="flex flex-col gap-0.5">
					{groups.map(({ station: dependent, entries }) => (
						<li key={dependent.id}>
							<Link
								href={stationHref(dependent.id)}
								className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2.5 gap-y-1 rounded-sm px-1.5 py-1.5 transition-colors hover:bg-highlight/5 focus-visible:outline-2 focus-visible:outline-brand"
							>
								<StationImage station={dependent} size={34} className="row-span-2" />
								<span className="truncate text-sm leading-tight text-foreground">{dependent.name}</span>
								<span className="flex flex-wrap gap-1">
									{entries.map((entry) => {
										const met = currentLevel >= entry.requiresLevel;
										return (
											<span
												key={entry.level}
												title={`${dependent.name} level ${entry.level} needs ${station.name} level ${entry.requiresLevel}${met ? " (met)" : ""}`}
												className="inline-flex items-center gap-1 rounded-sm bg-shadow/40 px-1.5 py-1 text-[11px] font-medium leading-none text-muted-foreground"
											>
												<span className="font-bold text-foreground">L{entry.level}</span>
												needs {station.name} L{entry.requiresLevel}
												{met && <Check size={10} aria-label="Met" className="text-success" />}
											</span>
										);
									})}
								</span>
							</Link>
						</li>
					))}
				</ul>
			) : (
				<p className="text-xs text-subtle-foreground">No other station upgrade requires {station.name}.</p>
			)}
		</DetailSection>
	);
}
