"use client";
import { useBattlePassData } from "../BattlePassSeason";

import { useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
	ChevronDown,
	ChevronRight,
	LayoutGrid,
	Map as MapIcon,
	Table2,
	TriangleAlert,
	X,
	ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { generatedBattlePassArtwork } from "@/lib/generated-battle-pass-artwork";
import { documentMapsHref, MAP_EXPLORER_MAPS, mapExplorerHref } from "@/lib/cfg/map-explorer";
import { useModeRoute } from "@/lib/useModeRoute";
import { cn } from "@/lib/utils";

import { documentDisplayName } from "../lib/battle-pass-display";

/** Short tile-row names that fit 120px rows: Financial, Project, BP and Tech, Personnel. */
const shortDocumentName = (name: string) =>
	documentDisplayName(name)
		.replace(/ Docs$/, "")
		.replace(/^PMC personnel$/, "Personnel");
import { LocationsDocumentArtwork } from "./ui/LocationsDocumentArtwork";
import { MapGrid } from "./MapGrid";
import { useBattlePassPreferences } from "../useBattlePassPreferences";

/** One map: thumbnail fills the tile, name top-left, its documents along the bottom over a gradient. */
function MapTile({ map, selected }: { map: string; selected: ReadonlySet<string> }) {
	const { mapThumbnails, documents, mapNames, documentMarks } = useBattlePassData();
	const { mode } = useModeRoute();
	const explorerMap = MAP_EXPLORER_MAPS.find((entry) => entry.name === map);
	const [failed, setFailed] = useState(false);
	const [useOriginal, setUseOriginal] = useState(false);
	const src = mapThumbnails[map.toLowerCase().replaceAll(" ", "-")];
	const variant = generatedBattlePassArtwork(src)?.[0];
	const docs = documents.filter((doc) => mapNames[doc.key]?.includes(map));
	const dimmed = selected.size > 0 && !docs.some((doc) => selected.has(doc.key));
	return (
		<section
			aria-label={map}
			data-dimmed={dimmed || undefined}
			className={cn(
				"relative isolate flex aspect-[4/3] min-h-56 min-w-0 flex-col justify-between overflow-hidden rounded-lg bg-surface-raised/50 transition-[opacity,filter]",
				dimmed && "opacity-30 grayscale",
			)}
		>
			{failed || !src ? (
				<MapIcon className="absolute inset-0 -z-10 m-auto size-10 text-subtle-foreground" aria-hidden />
			) : (
				<Image
					src={!useOriginal ? (variant ?? src) : src}
					unoptimized={!!variant && !useOriginal}
					alt=""
					fill
					sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
					onError={() => (variant && !useOriginal ? setUseOriginal(true) : setFailed(true))}
					className="-z-10 object-cover"
				/>
			)}
			<h3 className="bg-gradient-to-b from-black/70 to-transparent px-2.5 pt-2 pb-5 text-sm font-semibold text-white">
				{explorerMap ? (
					<Link
						href={mapExplorerHref(mode, explorerMap.key, "documents")}
						prefetch={false}
						aria-label={`${map} document map`}
						className="group/map inline-flex items-center gap-1 transition-colors hover:text-brand hover:underline focus-visible:text-brand"
					>
						{map}
						<ArrowUpRight
							className="size-4 text-brand opacity-0 transition-opacity group-hover/map:opacity-100 group-focus-visible/map:opacity-100"
							aria-hidden
						/>
					</Link>
				) : (
					map
				)}
			</h3>
			<ul
				aria-label={`${map} documents`}
				className="flex flex-col gap-1 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-2 pt-8 pb-2"
			>
				{docs.map((doc) => (
					<li
						key={doc.key}
						title={documentDisplayName(doc.name)}
						className="flex w-full max-w-[120px] min-w-0 items-center gap-1.5 rounded-md bg-black/55 py-0.5 pr-2 pl-0.5 text-xs font-medium text-white backdrop-blur-sm"
						style={selectedRing(selected.has(doc.key), documentMarks[doc.key]?.color)}
					>
						<LocationsDocumentArtwork doc={doc} className="size-8 shrink-0" />
						<span className="truncate">{shortDocumentName(doc.name)}</span>
					</li>
				))}
			</ul>
		</section>
	);
}

/** Selected documents get a thin inset border in their icon color; inset keeps the layout unchanged. */
function selectedRing(selected: boolean, color = "var(--brand)") {
	return selected ? { boxShadow: `inset 0 0 0 1px ${color}` } : undefined;
}

/** All document types as toggles; the square X clears the selection. Selection is view-only state. */
function DocumentFilter({
	selected,
	onToggle,
	onClear,
}: {
	selected: ReadonlySet<string>;
	onToggle: (key: string) => void;
	onClear: () => void;
}) {
	const { documents, documentMarks } = useBattlePassData();
	return (
		<div role="group" aria-label="Filter maps by document" className="mb-2 flex items-center gap-1.5">
			<div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
				{documents.map((doc) => {
					const active = selected.has(doc.key);
					return (
						<button
							key={doc.key}
							type="button"
							aria-pressed={active}
							title={documentDisplayName(doc.name)}
							onClick={() => onToggle(doc.key)}
							className={cn(
								"flex w-[120px] min-w-0 items-center gap-1.5 rounded-md bg-surface-raised/70 py-0.5 pr-2 pl-0.5 text-left text-xs font-medium transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand",
								active ? "text-foreground" : "text-foreground/80",
							)}
							style={selectedRing(active, documentMarks[doc.key]?.color)}
						>
							<LocationsDocumentArtwork doc={doc} className="size-8 shrink-0" />
							<span className="truncate">{shortDocumentName(doc.name)}</span>
						</button>
					);
				})}
			</div>
			<button
				type="button"
				aria-label="Clear document filter"
				disabled={selected.size === 0}
				onClick={onClear}
				className="grid size-9 shrink-0 place-items-center self-start rounded-md bg-surface-raised/70 text-foreground/80 transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-35"
			>
				<X className="size-4" aria-hidden />
			</button>
		</div>
	);
}

export function LocationsPanel() {
	const { locations, mapOrder } = useBattlePassData();
	const [selectedDocs, setSelectedDocs] = useState<ReadonlySet<string>>(() => new Set());
	const { mode } = useModeRoute();
	const [view, setView] = useState<"grid" | "table">("grid");
	const [{ showMaps: expanded }, setPreference] = useBattlePassPreferences();
	const panelId = useId();
	const viewId = useId();
	return (
		<section aria-label="Document locations" className="rounded-lg bg-card p-3 sm:p-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<Button
						iconOnly
						size="sm"
						aria-label={expanded ? "Hide document locations" : "Show document locations"}
						aria-expanded={expanded}
						aria-controls={panelId}
						onClick={() => setPreference("showMaps", !expanded)}
					>
						{expanded ? (
							<ChevronDown className="size-4" aria-hidden />
						) : (
							<ChevronRight className="size-4" aria-hidden />
						)}
					</Button>
					<div>
						<h2 className="text-sm font-semibold text-foreground">Document locations</h2>
						<p className="mt-1 text-xs text-muted-foreground">
							{locations.spawnsPerRelevantType.default} possible spawns per type,{" "}
							{locations.spawnsPerRelevantType.factory} on Factory, ? on Icebreaker
						</p>
					</div>
				</div>
				<div role="group" aria-label="Locations view" className="flex gap-1">
					<Link
						href={documentMapsHref(mode)}
						prefetch={false}
						className="mr-2 inline-flex items-center gap-1 text-xs text-brand underline underline-offset-2"
					>
						<MapIcon className="size-3.5" aria-hidden /> Document map
					</Link>
					<Button
						hidden={!expanded}
						selected={view === "grid"}
						aria-pressed={view === "grid"}
						aria-controls={viewId}
						onClick={() => setView("grid")}
					>
						<LayoutGrid className="size-3.5" aria-hidden /> Grid
					</Button>
					<Button
						hidden={!expanded}
						selected={view === "table"}
						aria-pressed={view === "table"}
						aria-controls={viewId}
						onClick={() => setView("table")}
					>
						<Table2 className="size-3.5" aria-hidden /> Table
					</Button>
				</div>
			</div>
			<div id={panelId} hidden={!expanded} className="mt-4">
				<div id={viewId}>
					{view === "table" ? (
						<MapGrid />
					) : (
						<>
							<DocumentFilter
								selected={selectedDocs}
								onClear={() => setSelectedDocs(new Set())}
								onToggle={(key) =>
									setSelectedDocs((current) => {
										const next = new Set(current);
										if (!next.delete(key)) next.add(key);
										return next;
									})
								}
							/>
							<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
								{mapOrder.map((map) => (
									<MapTile key={map} map={map} selected={selectedDocs} />
								))}
							</div>
						</>
					)}
				</div>
				<LocationsFooter />
			</div>
		</section>
	);
}

/** Shared by both views: the current data caveat and its sources. */
function LocationsFooter() {
	const { locations } = useBattlePassData();
	return (
		<div className="mt-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2 text-xs">
			<p className="flex max-w-3xl items-start gap-2 text-warning">
				<TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
				<span>
					{locations.icebreakerUpdate.note}{" "}
					<a
						href={locations.icebreakerUpdate.sourceUrl}
						target="_blank"
						rel="noreferrer"
						className="underline underline-offset-2 hover:text-brand"
					>
						Game update ↗
					</a>
				</span>
			</p>
			<a
				href={locations.corroboratingSourceUrl}
				target="_blank"
				rel="noreferrer"
				className="text-subtle-foreground hover:text-brand"
			>
				Spawn guides ↗
			</a>
		</div>
	);
}
