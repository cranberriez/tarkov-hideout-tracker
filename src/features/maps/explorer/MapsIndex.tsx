import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Map as MapIcon } from "lucide-react";
import {
	DEFAULT_MAP_VISIBILITY_PRESET,
	MAP_EXPLORER_MAPS,
	MAP_VISIBILITY_PRESETS,
	mapExplorerHref,
	type MapExplorerMapKey,
	type MapVisibilityPresetKey,
} from "@/lib/cfg/map-explorer";
import { cn } from "@/lib/utils";

/** Scenic card art in public/images/maps; variants share their base map's. */
const THUMBNAILS: Partial<Record<MapExplorerMapKey, string>> = {
	customs: "customs",
	factory: "factory",
	"night-factory": "factory",
	"ground-zero": "ground-zero",
	"ground-zero-21": "ground-zero",
	interchange: "interchange",
	lighthouse: "lighthouse",
	reserve: "reserve",
	shoreline: "shoreline",
	"streets-of-tarkov": "streets-of-tarkov",
	woods: "woods",
	"the-lab": "the-lab",
	"the-lab-dark": "the-lab",
	"the-labyrinth": "the-labyrinth",
	icebreaker: "icebreaker",
};

/** Lists every interactive map; the chosen visibility preset decides which markers each link opens with. */
export function MapsIndex({ preset }: { preset: MapVisibilityPresetKey }) {
	return (
		<main className="container mx-auto flex flex-col gap-6 px-6 py-8">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<h1 className="text-3xl font-bold tracking-tight text-foreground">MAPS</h1>
				<div className="flex flex-col items-end gap-1.5">
					<nav aria-label="Map presets" className="flex flex-wrap items-center justify-end gap-2">
						<span className="text-xs font-semibold uppercase tracking-wide text-subtle-foreground">Presets</span>
						{MAP_VISIBILITY_PRESETS.map((option) => {
							const active = option.key === preset;
							return (
								<Link
									key={option.key}
									href={option.key === DEFAULT_MAP_VISIBILITY_PRESET ? "/maps" : `/maps?preset=${option.key}`}
									scroll={false}
									replace
									aria-current={active ? "true" : undefined}
									title={option.description}
									className={cn(
										"rounded-full border px-3 py-1.5 text-sm transition-colors",
										active
											? "border-brand bg-brand text-inverse"
											: "border-border bg-card text-muted-foreground hover:border-brand hover:text-foreground",
									)}
								>
									{option.label}
								</Link>
							);
						})}
					</nav>
					<p className="text-sm text-muted-foreground">
						{MAP_VISIBILITY_PRESETS.find((option) => option.key === preset)?.description}
					</p>
				</div>
			</header>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
				{MAP_EXPLORER_MAPS.map((map) => {
					const thumbnail = THUMBNAILS[map.key];
					return (
						<Link
							key={map.key}
							href={mapExplorerHref(map.key, preset)}
							className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none"
						>
							<span className="relative aspect-[5/3] bg-muted">
								{thumbnail ? (
									<Image
										src={`/images/maps/${thumbnail}.webp`}
										alt=""
										fill
										sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
										className="object-cover"
									/>
								) : (
									<span className="flex h-full items-center justify-center text-muted-foreground">
										<MapIcon size={36} strokeWidth={1.25} aria-hidden />
									</span>
								)}
							</span>
							<span className="flex items-center justify-between gap-2 px-3 py-2.5">
								<span className="font-semibold text-foreground group-hover:text-brand">{map.name}</span>
								<ArrowRight size={16} className="text-brand transition-transform group-hover:translate-x-0.5" />
							</span>
						</Link>
					);
				})}
			</div>
		</main>
	);
}
