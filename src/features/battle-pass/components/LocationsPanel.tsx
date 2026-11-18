"use client";
import { useBattlePassData } from "../BattlePassSeason";

import { useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronRight, LayoutGrid, Map as MapIcon, Table2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generatedBattlePassArtwork } from "@/lib/generated-battle-pass-artwork";
import { documentMapsHref, MAP_EXPLORER_MAPS, mapExplorerHref } from "@/lib/cfg/map-explorer";
import { useModeRoute } from "@/lib/useModeRoute";

import { documentDisplayName } from "../lib/battle-pass-display";
import { LocationsDocumentArtwork } from "./ui/LocationsDocumentArtwork";
import { MapGrid } from "./MapGrid";
import { useBattlePassPreferences } from "../useBattlePassPreferences";

/** One map: thumbnail fills the tile, name top-left, its documents along the bottom over a gradient. */
function MapTile({ map }: { map: string }) {
	const { mapThumbnails, documents, mapNames } = useBattlePassData();
	const { mode } = useModeRoute();
	const explorerMap = MAP_EXPLORER_MAPS.find((entry) => entry.name === map);
	const [failed, setFailed] = useState(false);
	const [useOriginal, setUseOriginal] = useState(false);
	const src = mapThumbnails[map.toLowerCase().replaceAll(" ", "-")];
	const variant = generatedBattlePassArtwork(src)?.[0];
	const docs = documents.filter((doc) => mapNames[doc.key]?.includes(map));
	return (
		<section
			aria-label={map}
			className="relative isolate flex aspect-[4/3] min-w-0 flex-col justify-between overflow-hidden rounded-lg bg-surface-raised/50"
		>
			{failed || !src ? (
				<MapIcon className="absolute inset-0 -z-10 m-auto size-10 text-subtle-foreground" aria-hidden />
			) : (
				<Image
					src={!useOriginal ? (variant ?? src) : src}
					unoptimized={!!variant && !useOriginal}
					alt=""
					fill
					sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
					onError={() => (variant && !useOriginal ? setUseOriginal(true) : setFailed(true))}
					className="-z-10 object-cover"
				/>
			)}
			<h3 className="bg-gradient-to-b from-black/70 to-transparent px-2.5 pt-2 pb-5 text-xs font-semibold text-white">
				{explorerMap ? (
					<Link
						href={mapExplorerHref(mode, explorerMap.key, "documents")}
						prefetch={false}
						aria-label={`${map} document map`}
						className="hover:text-brand hover:underline"
					>
						{map}
					</Link>
				) : (
					map
				)}
			</h3>
			<ul
				aria-label={`${map} documents`}
				className="flex flex-wrap items-end gap-1 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-2 pt-6 pb-2"
			>
				{docs.map((doc) => (
					<li key={doc.key} title={documentDisplayName(doc.name)}>
						<LocationsDocumentArtwork doc={doc} className="size-10" />
						<span className="sr-only">{documentDisplayName(doc.name)}</span>
					</li>
				))}
			</ul>
		</section>
	);
}

export function LocationsPanel() {
	const { locations, mapOrder } = useBattlePassData();
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
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
							{mapOrder.map((map) => (
								<MapTile key={map} map={map} />
							))}
						</div>
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
