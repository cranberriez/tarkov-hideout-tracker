"use client";
import { useId, useState } from "react";
import Image from "next/image";
import { Columns3, Map as MapIcon, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { documents } from "../lib/battle-pass-model";
import { documentDisplayName, locations, mapNames, mapOrder } from "../lib/battle-pass-display";
import { LocationsDocumentArtwork } from "./ui/LocationsDocumentArtwork";
import { MapGrid } from "./MapGrid";

function MapHeading({ map }: { map: string }) {
	const [failed, setFailed] = useState(false);
	return (
		<div className="mb-3 flex min-h-24 flex-col items-center gap-2 text-center">
			{failed ? (
				<div className="grid h-14 w-full place-items-center bg-surface-raised/50">
					<MapIcon className="size-7 text-subtle-foreground" aria-hidden />
				</div>
			) : (
				<Image
					src={`/images/maps/${map.toLowerCase().replaceAll(" ", "-")}.webp`}
					alt=""
					width={480}
					height={288}
					unoptimized
					onError={() => setFailed(true)}
					className="h-14 w-full rounded-sm object-cover"
				/>
			)}
			<h3 className="text-xs leading-4 font-semibold text-foreground">{map}</h3>
		</div>
	);
}

export function LocationsPanel() {
	const [view, setView] = useState<"columns" | "table">("columns");
	const viewId = useId();
	return (
		<section aria-label="Document locations" className="rounded-lg bg-card p-3 sm:p-4">
			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="text-sm font-semibold text-foreground">Document locations</h2>
					<p className="mt-1 text-xs text-muted-foreground">
						{locations.spawnsPerRelevantType.default} possible spawns per type ·{" "}
						{locations.spawnsPerRelevantType.factory} on Factory
					</p>
				</div>
				<div role="group" aria-label="Locations view" className="flex gap-1">
					<Button
						selected={view === "columns"}
						aria-pressed={view === "columns"}
						aria-controls={viewId}
						onClick={() => setView("columns")}
					>
						<Columns3 className="size-3.5" aria-hidden /> Columns
					</Button>
					<Button
						selected={view === "table"}
						aria-pressed={view === "table"}
						aria-controls={viewId}
						onClick={() => setView("table")}
					>
						<Table2 className="size-3.5" aria-hidden /> Table
					</Button>
				</div>
			</div>
			<div id={viewId}>
				{view === "table" ? (
					<MapGrid />
				) : (
					<>
						<div className="overflow-x-auto pb-2">
							<div className="grid min-w-[1056px] grid-cols-12 items-stretch gap-2">
								{mapOrder.map((map) => (
									<section key={map} aria-label={map} className="min-w-0 rounded bg-surface-raised/40 px-1 py-2">
										<MapHeading map={map} />
										<div className="flex flex-col gap-3">
											{documents
												.filter((doc) => mapNames[doc.key]?.includes(map))
												.map((doc) => (
													<figure key={doc.key} title={documentDisplayName(doc.name)}>
														<div className="aspect-square w-full">
															<LocationsDocumentArtwork doc={doc} className="h-full w-full" />
														</div>
														<figcaption className="mt-1.5 text-center text-[11px] leading-3.5 text-muted-foreground">
															{documentDisplayName(doc.name)}
														</figcaption>
													</figure>
												))}
										</div>
									</section>
								))}
							</div>
						</div>
						<div className="mt-3 flex flex-wrap justify-between gap-2 text-[11px] text-subtle-foreground">
							<span>Possible spawns, not guaranteed pickups.</span>
							<a href={locations.corroboratingSourceUrl} target="_blank" rel="noreferrer" className="hover:text-brand">
								Spawn guides ↗
							</a>
						</div>
					</>
				)}
			</div>
		</section>
	);
}
