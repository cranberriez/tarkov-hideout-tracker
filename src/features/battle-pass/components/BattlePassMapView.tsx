"use client";
/* eslint-disable @next/next/no-img-element -- Source map and location photos retain their native URLs. */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ExternalLink, ImageOff, LockKeyhole, Map, Minus, Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { constrainMapView, zoomViewAroundPoint } from "@/features/maps/map-view-transform";
import { documents } from "../lib/battle-pass-model";
import { documentDisplayName, documentMarks } from "../lib/battle-pass-display";
import { documentMaps, documentLocations, type BattlePassDocumentLocation } from "@/lib/battle-pass-map-data";
import { arrangeDocumentMarkers } from "../lib/battle-pass-map-layout";
import { LocationsDocumentArtwork } from "./ui/LocationsDocumentArtwork";
import styles from "../battle-pass-map.module.css";

function LocationPhoto({ src, title }: { src?: string; title: string }) {
	const [state, setState] = useState<"loading" | "ready" | "error">("loading");
	return (
		<div className={styles.photo}>
			{!src || state === "error" ? (
				<div className={styles.photoFallback}>
					<ImageOff size={28} />
					<span>Location photo unavailable</span>
				</div>
			) : (
				<>
					{state === "loading" && (
						<div className={styles.photoFallback} role="status">
							Loading location photo…
						</div>
					)}
					<img
						src={src}
						alt={title}
						onLoad={() => setState("ready")}
						onError={() => setState("error")}
						style={{ visibility: state === "ready" ? "visible" : "hidden" }}
					/>
				</>
			)}
		</div>
	);
}

function LocationPreview({
	location,
	pinned,
	floorName,
	onClose,
	onPin,
}: {
	location: BattlePassDocumentLocation;
	pinned: boolean;
	floorName?: string;
	onClose: () => void;
	onPin: () => void;
}) {
	const doc = documents.find((entry) => entry.key === location.documentKey);
	const [photo, setPhoto] = useState(0);
	return (
		<aside
			className={styles.preview}
			data-pinned={pinned}
			aria-label="Location details"
			onFocusCapture={onPin}
			onPointerDown={(event) => event.stopPropagation()}
		>
			<div className={styles.previewHeading}>
				<div>
					<span style={{ color: documentMarks[location.documentKey]?.color }} className={styles.eyebrow}>
						{doc ? documentDisplayName(doc.name) : location.documentKey}
					</span>
					<h2>{location.title}</h2>
				</div>
				{pinned && (
					<Button iconOnly aria-label="Close location details" onClick={onClose}>
						<X size={16} />
					</Button>
				)}
			</div>
			<LocationPhoto
				key={`${location.id}:${location.screenshotUrls[photo]}`}
				src={location.screenshotUrls[photo]}
				title={`${location.title} — document spawn location`}
			/>
			<div className={styles.previewBody}>
				{location.screenshotUrls.length > 1 && (
					<div className="mb-2 flex items-center gap-2">
						<Button size="xs" disabled={photo === 0} onClick={() => setPhoto((current) => current - 1)}>
							Previous photo
						</Button>
						<span>
							{photo + 1} / {location.screenshotUrls.length}
						</span>
						<Button
							size="xs"
							disabled={photo === location.screenshotUrls.length - 1}
							onClick={() => setPhoto((current) => current + 1)}
						>
							Next photo
						</Button>
					</div>
				)}
				<p>
					{floorName ?? location.floor ?? "Floor not specified by source"}
					{location.key && (
						<span className={styles.key}>
							<LockKeyhole size={14} /> {location.key}
						</span>
					)}
				</p>
				{location.description && <p>{location.description}</p>}
				{!location.verified && <p className="text-warning">Unconfirmed spawn — source verification pending.</p>}
				{location.sourceUrl && (
					<a href={location.sourceUrl} target="_blank" rel="noreferrer">
						Location guide <ExternalLink size={12} />
					</a>
				)}
				<span className={styles.hint}>{pinned ? "Pinned location" : "Click a marker to pin this location."}</span>
			</div>
		</aside>
	);
}

export function BattlePassMapView({ onClose }: { onClose: () => void }) {
	const [mapId, setMapId] = useState(documentMaps[0]?.id ?? "");
	const [floor, setFloor] = useState("all");
	const [hiddenTypes, setHiddenTypes] = useState<string[]>([]);
	const [hovered, setHovered] = useState<string | null>(null);
	const [pinned, setPinned] = useState<string | null>(null);
	const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
	const [size, setSize] = useState({ width: 0, height: 0 });
	const [imageState, setImageState] = useState<"loading" | "ready" | "error">("loading");
	const [imageAttempt, setImageAttempt] = useState(0);
	const viewport = useRef<HTMLDivElement>(null);
	const drag = useRef<{ pointer: number; x: number; y: number; viewX: number; viewY: number } | null>(null);
	const map = documentMaps.find((entry) => entry.id === mapId);
	const mapLocations = useMemo(() => documentLocations.filter((location) => location.mapId === mapId), [mapId]);
	const presentFloors = new Set(
		mapLocations.map((location) => location.floor).filter((value): value is string => Boolean(value)),
	);
	const floors = [
		...(map?.floors.map((entry) => entry.id).filter((id) => presentFloors.has(id)) ?? []),
		...[...presentFloors].filter((id) => !map?.floors.some((entry) => entry.id === id)),
	];
	const visible = mapLocations.filter(
		(location) =>
			!hiddenTypes.includes(location.documentKey) &&
			(floor === "all" || (floor === "unknown" ? !location.floor : location.floor === floor)),
	);
	const active = visible.find((location) => location.id === (pinned ?? hovered));
	const fit = map && size.width ? Math.min(size.width / map.width, size.height / map.height) * 0.94 : 1;
	const stage = { width: (map?.width ?? 1) * fit, height: (map?.height ?? 1) * fit };
	const offsets = arrangeDocumentMarkers(
		visible.map((location) => ({
			id: location.id,
			x: location.x * fit * view.scale + (size.width - stage.width * view.scale) / 2 + view.x,
			y: location.y * fit * view.scale + (size.height - stage.height * view.scale) / 2 + view.y,
		})),
		38,
		size.width > 0 && size.height > 0 ? { ...size, padding: 24 } : undefined,
	);

	useEffect(() => {
		const element = viewport.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) =>
			setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);
	useEffect(() => {
		function closeOnEscape(event: KeyboardEvent) {
			if (event.key === "Escape") onClose();
		}
		document.addEventListener("keydown", closeOnEscape);
		return () => document.removeEventListener("keydown", closeOnEscape);
	}, [onClose]);
	function changeMap(id: string) {
		setMapId(id);
		setFloor("all");
		setHovered(null);
		setPinned(null);
		setView({ scale: 1, x: 0, y: 0 });
		setImageState("loading");
	}
	function zoom(factor: number, point = { x: 0, y: 0 }) {
		setView((current) => constrainMapView(zoomViewAroundPoint(current, factor, point, 1, 8), stage, size));
	}
	function toggleType(key: string) {
		if (!hiddenTypes.includes(key)) {
			if (mapLocations.find((location) => location.id === pinned)?.documentKey === key) setPinned(null);
			if (mapLocations.find((location) => location.id === hovered)?.documentKey === key) setHovered(null);
		}
		setHiddenTypes((current) => (current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]));
	}

	return (
		<section className={styles.root} aria-label="Battle pass document map">
			<header className={styles.header}>
				<div className={styles.title}>
					<Map size={20} />
					<div>
						<h1>Document locations</h1>
						<p>Possible spawns · hover to preview, click to pin</p>
					</div>
				</div>
				<div className={styles.selectors}>
					<label>
						Map
						<select value={mapId} onChange={(event) => changeMap(event.target.value)}>
							{documentMaps.map((entry) => (
								<option key={entry.id} value={entry.id}>
									{entry.name}
								</option>
							))}
						</select>
					</label>
					<label>
						Floor
						<select
							value={floor}
							onChange={(event) => {
								setFloor(event.target.value);
								setPinned(null);
								setHovered(null);
							}}
						>
							<option value="all">All floors</option>
							{floors.map((entry) => (
								<option key={entry} value={entry}>
									{map?.floors.find((candidate) => candidate.id === entry)?.name ?? entry}
								</option>
							))}
							{mapLocations.some((location) => !location.floor) && <option value="unknown">Unspecified floor</option>}
						</select>
					</label>
				</div>
				<Button onClick={onClose}>
					<X size={16} /> Close map
				</Button>
			</header>
			<div className={styles.filters} role="group" aria-label="Document types">
				{documents
					.filter((doc) => mapLocations.some((location) => location.documentKey === doc.key))
					.map((doc) => (
						<button
							key={doc.key}
							type="button"
							aria-pressed={!hiddenTypes.includes(doc.key)}
							className={styles.filter}
							style={{ "--document-color": documentMarks[doc.key]?.color } as CSSProperties}
							onClick={() => toggleType(doc.key)}
						>
							<LocationsDocumentArtwork doc={doc} className="size-7" />
							<span>{documentDisplayName(doc.name)}</span>
							<span className={styles.count}>
								{mapLocations.filter((location) => location.documentKey === doc.key).length}
							</span>
						</button>
					))}
				<span className={styles.visibleCount}>
					{visible.length} / {mapLocations.length} locations
				</span>
				{hiddenTypes.length > 0 && (
					<Button size="xs" onClick={() => setHiddenTypes([])}>
						Show all types
					</Button>
				)}
			</div>
			<div className={styles.mapArea}>
				<div
					ref={viewport}
					className={styles.viewport}
					onWheel={(event) => {
						const rect = event.currentTarget.getBoundingClientRect();
						zoom(event.deltaY < 0 ? 1.15 : 1 / 1.15, {
							x: event.clientX - rect.left - rect.width / 2,
							y: event.clientY - rect.top - rect.height / 2,
						});
					}}
					onPointerDown={(event) => {
						if (event.button !== 0 || (event.target as HTMLElement).closest("button, a, aside")) return;
						event.currentTarget.setPointerCapture(event.pointerId);
						drag.current = {
							pointer: event.pointerId,
							x: event.clientX,
							y: event.clientY,
							viewX: view.x,
							viewY: view.y,
						};
						setHovered(null);
					}}
					onPointerMove={(event) => {
						if (drag.current?.pointer !== event.pointerId) return;
						setView(
							constrainMapView(
								{
									scale: view.scale,
									x: drag.current.viewX + event.clientX - drag.current.x,
									y: drag.current.viewY + event.clientY - drag.current.y,
								},
								stage,
								size,
							),
						);
					}}
					onPointerUp={() => {
						drag.current = null;
					}}
					onPointerCancel={() => {
						drag.current = null;
					}}
				>
					{map ? (
						<div
							className={styles.stage}
							style={{
								width: stage.width,
								height: stage.height,
								transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
							}}
						>
							<img
								key={`${map.id}:${imageAttempt}`}
								className={styles.mapImage}
								src={map.imageUrl}
								alt={`${map.name} map`}
								draggable={false}
								onLoad={() => setImageState("ready")}
								onError={() => setImageState("error")}
							/>
							{imageState === "ready" &&
								visible.map((location, index) => {
									const doc = documents.find((entry) => entry.key === location.documentKey);
									const offset = offsets[index];
									const color = documentMarks[location.documentKey]?.color;
									return (
										<div
											key={location.id}
											className={styles.anchor}
											style={
												{
													left: `${(location.x / map.width) * 100}%`,
													top: `${(location.y / map.height) * 100}%`,
													transform: `scale(${1 / view.scale})`,
													"--document-color": color,
												} as CSSProperties
											}
										>
											{Math.hypot(offset.x, offset.y) > 0 && (
												<>
													<span className={styles.anchorDot} />
													<span
														className={styles.leader}
														style={{
															width: Math.hypot(offset.x, offset.y),
															transform: `rotate(${Math.atan2(offset.y, offset.x)}rad)`,
														}}
													/>
												</>
											)}
											<button
												type="button"
												className={styles.marker}
												data-active={active?.id === location.id}
												style={{ transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)` }}
												aria-label={`${doc ? documentDisplayName(doc.name) : location.documentKey}: ${location.title}${location.key ? ", key required" : ""}`}
												aria-pressed={pinned === location.id}
												onPointerEnter={(event) => {
													if (event.pointerType === "mouse") setHovered(location.id);
												}}
												onFocus={() => {
													// Touch focus occurs before click; moving a sheet then can swallow the tap.
													if (document.activeElement?.matches(":focus-visible")) setHovered(location.id);
												}}
												onClick={() => {
													setPinned((current) => (current === location.id ? null : location.id));
													setHovered(location.id);
												}}
											>
												<LocationsDocumentArtwork doc={doc ?? { key: location.documentKey }} className="size-7" />
												{location.key && (
													<span className={styles.markerLock}>
														<LockKeyhole size={10} />
													</span>
												)}
											</button>
										</div>
									);
								})}
						</div>
					) : (
						<div className={styles.status}>No document maps available.</div>
					)}
					{map && imageState === "loading" && (
						<div className={styles.status} role="status">
							Loading {map.name} map…
						</div>
					)}
					{map && imageState === "error" && (
						<div className={styles.status} role="alert">
							<ImageOff />
							<p>Map image could not be loaded.</p>
							<Button
								onClick={() => {
									setImageState("loading");
									setImageAttempt((attempt) => attempt + 1);
								}}
							>
								Retry image
							</Button>
							<a href={map.sourceUrl} target="_blank" rel="noreferrer">
								Open source map ↗
							</a>
						</div>
					)}
					{imageState === "ready" && visible.length === 0 && (
						<div className={styles.empty}>
							No locations match these filters.
							<Button
								size="xs"
								onClick={() => {
									setHiddenTypes([]);
									setFloor("all");
								}}
							>
								Reset filters
							</Button>
						</div>
					)}
					<div className={styles.controls}>
						<Button iconOnly aria-label="Zoom in" disabled={view.scale >= 8} onClick={() => zoom(1.4)}>
							<Plus size={18} />
						</Button>
						<Button iconOnly aria-label="Zoom out" disabled={view.scale <= 1} onClick={() => zoom(1 / 1.4)}>
							<Minus size={18} />
						</Button>
						<Button iconOnly aria-label="Fit map" onClick={() => setView({ scale: 1, x: 0, y: 0 })}>
							<RotateCcw size={16} />
						</Button>
					</div>
				</div>
				{active && (
					<LocationPreview
						key={active.id}
						location={active}
						pinned={Boolean(pinned)}
						floorName={map?.floors.find((candidate) => candidate.id === active.floor)?.name}
						onPin={() => setPinned(active.id)}
						onClose={() => {
							setPinned(null);
							setHovered(null);
						}}
					/>
				)}
			</div>
			<footer className={styles.footer}>
				<span>
					Drag to pan · scroll to zoom · <LockKeyhole size={11} /> key required
				</span>
				{map && (
					<a href={map.sourceUrl} target="_blank" rel="noreferrer" title={`${map.attribution} ${map.license}`}>
						Locations & maps: TarkovDoc · Game assets © BSG <ExternalLink size={11} />
					</a>
				)}
			</footer>
		</section>
	);
}
