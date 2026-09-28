"use client";

import Image from "next/image";
import Link from "next/link";
import { Crown } from "lucide-react";
import { stationOrder } from "@/lib/cfg/stationOrder";
import { STATIC_STATIONS } from "@/lib/data/static-stations";
import { stationHref } from "@/lib/entity-routes";
import { useUserStore } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";

const orderIndex = (normalizedName: string) => {
	const index = stationOrder.indexOf(normalizedName);
	return index === -1 ? stationOrder.length : index;
};

/**
 * Static list (no data fetch in the shared layout) in the reviewed in-game progression
 * order; stations missing from that order follow alphabetically.
 */
const stations = [...STATIC_STATIONS].sort(
	(a, b) => orderIndex(a.normalizedName) - orderIndex(b.normalizedName) || a.name.localeCompare(b.name),
);

/** Bundled portrait, e.g. "Hall of Fame" → /images/hideout/Hall_of_Fame_Portrait.webp. */
const portraitSrc = (name: string) => `/images/hideout/${name.replace(/ /g, "_")}_Portrait.webp`;

/** Hideout nav dropdown body: every station with the active profile's saved level. */
export function HideoutStationsNav({ currentPage }: { currentPage: string }) {
	const stationLevels = useUserStore((state) => state.stationLevels);
	return (
		// Column-major so each column follows the progression order top to bottom.
		<div
			className="grid grid-flow-col grid-cols-2 gap-x-1 gap-y-0.5"
			style={{ gridTemplateRows: `repeat(${Math.ceil(stations.length / 2)}, auto)` }}
		>
			{stations.map((station) => {
				const href = stationHref(station.id);
				const level = stationLevels[station.id] ?? 0;
				const maxed = level >= station.levels.length;
				return (
					<Link
						key={station.id}
						href={href}
						role="menuitem"
						className={cn(
							"flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
							currentPage === href && "bg-accent text-accent-foreground",
						)}
					>
						<Image
							src={portraitSrc(station.name)}
							alt=""
							width={18}
							height={18}
							className="size-[18px] shrink-0 rounded-xs object-cover"
						/>
						<span className="min-w-0 flex-1 truncate">{station.name}</span>
						{maxed ? (
							<Crown size={12} aria-label="Max level" className="shrink-0 text-warning" />
						) : (
							<span className="shrink-0 font-mono text-[10px] text-muted-foreground" aria-label={`Level ${level}`}>
								{level}
							</span>
						)}
					</Link>
				);
			})}
		</div>
	);
}
