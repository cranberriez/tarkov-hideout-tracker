"use client";
/* eslint-disable @next/next/no-img-element -- Source map and location photos retain their native URLs. */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
	ChevronDown,
	ChevronUp,
	ExternalLink,
	FileText,
	ImageOff,
	Palette,
	LockKeyhole,
	Minus,
	Plus,
	RotateCcw,
	X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { constrainMapView, zoomViewAroundPoint } from "@/features/maps/map-view-transform";
import { documents } from "../lib/battle-pass-model";
import { documentDisplayName, documentMarks } from "../lib/battle-pass-display";
import { documentMaps, documentLocations, type BattlePassDocumentLocation } from "@/lib/battle-pass-map-data";
import { filterDocumentLocations, documentMapCounts } from "../lib/battle-pass-map-controls";
import { resolveDocumentBasemap } from "../lib/battle-pass-map-background";
import { arrangeDocumentMarkers } from "../lib/battle-pass-map-layout";
import { MapDocumentPanel } from "./MapDocumentPanel";
import { CompactDocumentGlyph } from "./ui/CompactDocumentGlyph";
import { LocationsDocumentArtwork } from "./ui/LocationsDocumentArtwork";
import { useDocumentMapNavigation } from "../useDocumentMapNavigation";
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
				<LocationsDocumentArtwork doc={doc ?? { key: location.documentKey }} className={styles.previewDocument} />
				<div className={styles.previewTitle}>
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
				<span className={styles.hint}>{pinned ? "Pinned location" : "Click a marker to pin this location."}</span>
			</div>
		</aside>
	);
}

export function BattlePassMapView({ onClose }: { onClose: () => void }) {
	const { mapId, view, hiddenTypes, mapColors, setMapColors, setView, setHiddenTypes, changeMap } =
		useDocumentMapNavigation();
	const [hovered, setHovered] = useState<string | null>(null);
	const [pinned, setPinned] = useState<string | null>(null);
	const [size, setSize] = useState({ width: 0, height: 0 });
	const [imageState, setImageState] = useState<"loading" | "ready" | "error">("loading");
	const [imageAttempt, setImageAttempt] = useState(0);
	const [useOriginal, setUseOriginal] = useState(false);
	const [headerHidden, setHeaderHidden] = useState(false);
	const [documentsOpen, setDocumentsOpen] = useState(false);
	const documentsButton = useRef<HTMLButtonElement>(null);
	const documentsPanel = useRef<HTMLElement>(null);
	const header = useRef<HTMLElement>(null);
	const [headerHeight, setHeaderHeight] = useState(0);
	const [renderedMapId, setRenderedMapId] = useState(mapId);
	if (renderedMapId !== mapId) {
		setRenderedMapId(mapId);
		setUseOriginal(false);
		setHovered(null);
		setPinned(null);
		setImageState("loading");
	}
	const viewport = useRef<HTMLDivElement>(null);
	const bottomControls = useRef<HTMLDivElement>(null);
	const [controlsHeight, setControlsHeight] = useState(0);
	const drag = useRef<{ pointer: number; x: number; y: number; viewX: number; viewY: number } | null>(null);
	const map = documentMaps.find((entry) => entry.id === mapId);
	const background = map ? resolveDocumentBasemap(map, useOriginal) : undefined;
	const mapLocations = useMemo(() => documentLocations.filter((location) => location.mapId === mapId), [mapId]);
	const mapDocuments = documents.filter(
		(doc) => map && (doc.key in map.spawns || mapLocations.some((location) => location.documentKey === doc.key)),
	);
	const visible = filterDocumentLocations(mapLocations, hiddenTypes);
	const active = visible.find((location) => location.id === (pinned ?? hovered));
	const fit =
		background && size.width ? Math.min(size.width / background.width, size.height / background.height) * 0.94 : 1;
	const stage = { width: (background?.width ?? 1) * fit, height: (background?.height ?? 1) * fit };
	const offsets = arrangeDocumentMarkers(
		visible.map((location) => {
			const point = background?.project(location) ?? location;
			return {
				id: location.id,
				x: point.x * fit * view.scale + (size.width - stage.width * view.scale) / 2 + view.x,
				y: point.y * fit * view.scale + (size.height - stage.height * view.scale) / 2 + view.y,
			};
		}),
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
		const element = bottomControls.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => setControlsHeight(entry.contentRect.height));
		observer.observe(element);
		return () => observer.disconnect();
	}, []);
	useEffect(() => {
		const element = header.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) =>
			setHeaderHeight(entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height),
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);
	useEffect(() => {
		function closeOnEscape(event: KeyboardEvent) {
			if (event.key !== "Escape" || event.defaultPrevented) return;
			if (documentsOpen) {
				event.preventDefault();
				setDocumentsOpen(false);
				documentsButton.current?.focus();
			} else onClose();
		}
		document.addEventListener("keydown", closeOnEscape);
		return () => document.removeEventListener("keydown", closeOnEscape);
	}, [onClose, documentsOpen]);
	useEffect(() => {
		if (!documentsOpen) return;
		documentsPanel.current?.focus();
		function dismissOutside(event: PointerEvent) {
			const target = event.target as Node;
			if (!documentsPanel.current?.contains(target) && !documentsButton.current?.contains(target)) {
				setDocumentsOpen(false);
			}
		}
		document.addEventListener("pointerdown", dismissOutside);
		return () => document.removeEventListener("pointerdown", dismissOutside);
	}, [documentsOpen]);
	function zoom(factor: number, point = { x: 0, y: 0 }) {
		setView((current) => constrainMapView(zoomViewAroundPoint(current, factor, point, 1, 8), stage, size, 0.5));
	}
	function toggleType(key: string) {
		if (!hiddenTypes.includes(key)) {
			if (mapLocations.find((location) => location.id === pinned)?.documentKey === key) setPinned(null);
			if (mapLocations.find((location) => location.id === hovered)?.documentKey === key) setHovered(null);
		}
		setHiddenTypes((current) => (current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]));
	}

	return (
		<section
			className={styles.root}
			aria-label="Battle pass document map"
			style={{ "--selector-clearance": `${headerHidden ? 0 : headerHeight}px` } as CSSProperties}
		>
			<header ref={header} className={styles.header} id="document-map-selector" hidden={headerHidden}>
				<nav className={styles.mapTabs} aria-label="Choose document map">
					<div className={styles.mapTabsInner}>
						{documentMaps.map((entry) => (
							<button
								key={entry.id}
								type="button"
								className={styles.mapTab}
								aria-pressed={mapId === entry.id}
								onClick={() => changeMap(entry.id)}
							>
								<img src={`/images/maps/${entry.slug}.webp`} alt="" className={styles.mapTabImage} />
								<span className={styles.mapTabName}>{entry.name}</span>
								<span className={styles.mapTabDocuments} aria-hidden="true">
									{documents
										.filter((doc) => doc.key in entry.spawns)
										.map((doc) => (
											<LocationsDocumentArtwork key={doc.key} doc={doc} className="size-7" />
										))}
								</span>
							</button>
						))}
					</div>
				</nav>
			</header>
			<div className={styles.headerActions}>
				<Button
					iconOnly
					tone="danger"
					variant="solid"
					aria-label="Close document map"
					title="Close document map"
					onClick={onClose}
				>
					<X size={18} />
				</Button>
				<Button
					iconOnly
					aria-label={headerHidden ? "Show map selector" : "Hide map selector"}
					title={headerHidden ? "Show map selector" : "Hide map selector"}
					aria-controls="document-map-selector"
					aria-expanded={!headerHidden}
					onClick={() => setHeaderHidden((current) => !current)}
				>
					{headerHidden ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
				</Button>
				<Button
					ref={documentsButton}
					iconOnly
					aria-label={documentsOpen ? "Close document panel" : "Open document panel"}
					title="Documents"
					aria-controls="map-documents"
					aria-expanded={documentsOpen}
					onClick={() => setDocumentsOpen((current) => !current)}
				>
					{documentsOpen ? <X size={18} /> : <FileText size={18} />}
				</Button>
			</div>
			{documentsOpen && <MapDocumentPanel ref={documentsPanel} />}
			<div
				className={styles.mapArea}
				data-header-hidden={headerHidden}
				style={{ "--controls-clearance": `${controlsHeight + 28}px` } as CSSProperties}
			>
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
								0.5,
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
					{map && background ? (
						<div
							className={styles.stage}
							style={{
								width: stage.width,
								height: stage.height,
								transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
							}}
						>
							<img
								key={`${map.id}:${background.imageUrl}:${imageAttempt}`}
								className={styles.mapImage}
								data-colors={mapColors}
								src={background.imageUrl}
								alt={`${map.name} map`}
								draggable={false}
								onLoad={(event) => {
									if (
										background.usesReplacement &&
										!background.matchesDimensions(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)
									) {
										setUseOriginal(true);
										setImageState("loading");
									} else setImageState("ready");
								}}
								onError={() => {
									if (background.usesReplacement) {
										setUseOriginal(true);
										setImageState("loading");
									} else setImageState("error");
								}}
							/>
							{imageState === "ready" &&
								visible.map((location, index) => {
									const doc = documents.find((entry) => entry.key === location.documentKey);
									const offset = offsets[index];
									const point = background.project(location);
									const color = documentMarks[location.documentKey]?.color;
									return (
										<div
											key={location.id}
											className={styles.anchor}
											style={
												{
													left: `${(point.x / background.width) * 100}%`,
													top: `${(point.y / background.height) * 100}%`,
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
												data-compact={offset.compact}
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
												{offset.compact && (
													<span className={styles.compactGlyph}>
														<CompactDocumentGlyph documentKey={location.documentKey} />
													</span>
												)}
												<span className={styles.markerArtwork}>
													<LocationsDocumentArtwork doc={doc ?? { key: location.documentKey }} className="size-7" />
												</span>
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
							<a href={background?.sourceUrl ?? map.sourceUrl} target="_blank" rel="noreferrer">
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
						<Button
							iconOnly
							aria-label={mapColors ? "Use grayscale map" : "Show map colors"}
							title={mapColors ? "Use grayscale map" : "Show map colors"}
							aria-pressed={mapColors}
							onClick={() => setMapColors((current) => !current)}
						>
							<Palette size={18} />
						</Button>
					</div>
				</div>
				<div ref={bottomControls} className={styles.bottomControls}>
					<div className={styles.filters} role="group" aria-label="Document types">
						{map &&
							mapDocuments.map((doc) => {
								const counts = documentMapCounts(map, mapLocations, doc.key);
								return (
									<button
										key={doc.key}
										type="button"
										aria-pressed={!hiddenTypes.includes(doc.key)}
										className={styles.filter}
										style={{ "--document-color": documentMarks[doc.key]?.color } as CSSProperties}
										onClick={() => toggleType(doc.key)}
									>
										<LocationsDocumentArtwork doc={doc} className="size-9" />
										<span className={styles.filterText}>
											<strong>{documentDisplayName(doc.name)}</strong>
											<span className={styles.count}>
												{counts.possibleSpots} possible spots · {counts.raidSpawns ?? "Unknown"} spawns per raid
											</span>
										</span>
									</button>
								);
							})}
					</div>
				</div>
				{active && !documentsOpen && (
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
					<span>
						<a href={map.sourceUrl} target="_blank" rel="noreferrer">
							Locations: TarkovDoc
						</a>
						·
						<a
							href={background?.sourceUrl ?? map.sourceUrl}
							target="_blank"
							rel="noreferrer"
							title={background?.license ?? map.license}
						>
							Map: {(background?.attribution ?? map.attribution).replace(/^Map:\s*/i, "")} <ExternalLink size={11} />
						</a>
					</span>
				)}
			</footer>
		</section>
	);
}
