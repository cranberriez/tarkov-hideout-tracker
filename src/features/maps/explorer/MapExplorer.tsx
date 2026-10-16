"use client";

import "./map-explorer.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { MAP_VISIBILITY_PRESETS, type MapExplorerMapKey, type MapVisibilityPresetKey } from "@/lib/cfg/map-explorer";
import { toTarkovJsonGameMode, type TarkovJsonGameMode } from "@/lib/game-mode";
import { useGameDataEnabled } from "@/lib/query/game-data";
import { gameDataKey } from "@/lib/query/scope";
import { fetchJson, ResponseValidationError } from "@/lib/query/request";
import { useUserStore } from "@/lib/stores/useUserStore";
import { standardItemImageUrl } from "@/lib/utils/item-images";
import {
	artStyleOf,
	baseFloor,
	buildMarkers,
	countMarkers,
	defaultFilters,
	documentLocations,
	floorAt,
	floorById,
	floorOf,
	floorsOf,
	isVisible,
	layersFor,
	MapAssetsContext,
	mapName,
	resolveMap,
	TarkovMap,
	webAssets,
	withDefaults,
	type FloorSelection,
	type GameMapData,
	type Lookups,
	type MapAssets,
	type MapMarker,
	type TarkovMapHandle,
} from "../tarkov-map";
import { CoinIcon, LayersIcon, MinusIcon, PlusIcon, SplitIcon, TerrainIcon } from "./icons";
import { MapLayersPanel } from "./MapLayersPanel";
import { MapMarkerCard } from "./MapMarkerCard";
import { MapFloorPanel, MapSwitcher } from "./MapPanels";
import { bestLooseItems, looseItemIds, useMapItems } from "./useMapItems";
import { useMapExplorerPreferences } from "./useMapExplorerPreferences";
import { presetFilters } from "./visibility-presets";
import { MapQuestDrawer, type QuestFocus } from "./quests/MapQuestDrawer";
import { CATEGORY_TYPES, explorerPreset, questLayerFor, QUEST_LAYER } from "./quests/quest-map-markers";
import { QuestMarkerGlyph, questColors } from "./quests/QuestMarkerGlyph";
import { useMapQuests } from "./quests/useMapQuests";

type MapExplorerData = { map: GameMapData; lookups: Lookups };

function mapExplorerQueryOptions(mode: TarkovJsonGameMode, mapKey: string) {
	return queryOptions({
		queryKey: gameDataKey(mode, "map-explorer", mapKey),
		queryFn: async ({ signal }) => {
			const payload = await fetchJson<Partial<MapExplorerData>>(
				`/api/maps/explorer/${encodeURIComponent(mapKey)}?mode=${mode}`,
				{ signal },
			);
			if (!payload.map || typeof payload.map.normalizedName !== "string" || !payload.lookups) {
				throw new ResponseValidationError("Map data is invalid");
			}
			return payload as MapExplorerData;
		},
		staleTime: 60 * 60 * 1000,
		gcTime: 24 * 60 * 60 * 1000,
		retry: false,
	});
}

/** Item art at 512px: transparent and square, unlike the `icon` variant whose baked-in background frame is off-centre for non-square items. */
const explorerAssets: MapAssets = { ...webAssets, item: (id) => standardItemImageUrl(id, "512") };

/** Legend rows of the quest layer show the objective type's icon on a neutral disc. */
const legendGlyph = (layer: string, group: string) =>
	layer === QUEST_LAYER ? (
		<QuestMarkerGlyph type={CATEGORY_TYPES[group as keyof typeof CATEGORY_TYPES] ?? "other"} color="#4a4845" />
	) : undefined;

/**
 * Full-screen interactive map (ported from tarkov-mappinator's map page, without raid tracking): vector art or tiles
 * by floor, tarkov.dev markers under a tiered filter with saved and built-in presets, and marker detail cards.
 */
export function MapExplorer({
	mapKey,
	initialPreset,
}: {
	mapKey: MapExplorerMapKey;
	initialPreset: MapVisibilityPresetKey | null;
}) {
	const mode = toTarkovJsonGameMode(useUserStore((state) => state.gameMode));
	const enabled = useGameDataEnabled(mode);
	const query = useQuery({ ...mapExplorerQueryOptions(mode, mapKey), enabled });
	const data = query.data;

	useEffect(() => {
		document.body.classList.add("map-explorer-active");
		return () => document.body.classList.remove("map-explorer-active");
	}, []);

	const preferences = useMapExplorerPreferences();
	const setPreferences = preferences.set;
	const calibration = resolveMap(mapKey);
	const map = useRef<TarkovMapHandle>(null);
	// Vector art by default; tiles when chosen or when the map has no vector art.
	const style = artStyleOf(calibration, preferences.art);
	const split = preferences.split && style !== null;

	const documents = useMemo(() => documentLocations(mapKey), [mapKey]);
	const quests = useMapQuests(mode, mapKey);
	const mapMarkers = useMemo(
		() => (data ? buildMarkers(data.map, data.lookups, explorerPreset, documents) : []),
		[data, documents],
	);
	const overlay = useMemo(() => [...quests.markers, ...mapMarkers], [quests.markers, mapMarkers]);
	const overlayById = useMemo(() => new Map(overlay.map((marker) => [marker.id, marker])), [overlay]);
	const priced = useMemo(
		() => (preferences.valuableLoot ? looseItemIds(overlay) : []),
		[preferences.valuableLoot, overlay],
	);
	const items = useMapItems(mode, priced);
	const lootIcons = useMemo(
		() => (preferences.valuableLoot ? bestLooseItems(overlay, items.get) : undefined),
		[preferences.valuableLoot, overlay, items.get],
	);

	const counts = useMemo(() => countMarkers(overlay), [overlay]);
	const layerDefs = useMemo(
		() => questLayerFor(layersFor(overlay, data?.map.looseCategories, explorerPreset), overlay),
		[overlay, data],
	);
	const defaults = useMemo(() => defaultFilters("unknown", explorerPreset), []);
	const filters = useMemo(
		() => withDefaults(preferences.filters ?? undefined, "unknown", explorerPreset),
		[preferences.filters],
	);
	const setFilters = useCallback((next: typeof filters) => setPreferences({ filters: next }), [setPreferences]);
	// The quest open in the drawer shows all its markers, whatever the quest layer's filters say.
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [selectedQuest, setSelectedQuest] = useState<string | null>(null);
	const forcedQuest = drawerOpen ? selectedQuest : null;
	const shownOverlay = useMemo(
		() =>
			overlay.filter(
				(marker) =>
					(forcedQuest !== null && marker.quest?.questId === forcedQuest) || isVisible(marker, filters, explorerPreset),
			),
		[overlay, filters, forcedQuest],
	);

	// A preset from the link applies once this map's layers are known (its data-only groups need them), then leaves the URL.
	const pendingPreset = useRef(initialPreset);
	useEffect(() => {
		if (!pendingPreset.current || !data) return;
		const preset = MAP_VISIBILITY_PRESETS.find((candidate) => candidate.key === pendingPreset.current);
		if (preset) setFilters(presetFilters(preset, layerDefs));
		pendingPreset.current = null;
		const url = new URL(window.location.href);
		url.searchParams.delete("preset");
		window.history.replaceState(window.history.state, "", url);
	}, [data, layerDefs, setFilters]);

	// Hovering previews a marker's card; clicking pins it until closed (X, Escape, clicking it again) or another is clicked.
	const [hovered, setHovered] = useState<string | null>(null);
	const [pinned, setPinned] = useState<string | null>(null);
	const [shownData, setShownData] = useState(data);
	if (shownData !== data) {
		setShownData(data);
		setHovered(null);
		setPinned(null);
	}
	useEffect(() => {
		if (!pinned) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setPinned(null);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [pinned]);
	const cardMarker = overlayById.get(pinned ?? hovered ?? "");

	// Quest drawer: a quest hovered there dims every other quest's markers (an objective, every other objective);
	// a quest marker hovered on the map marks its row; clicking either opens that quest's details.
	const [questFocus, setQuestFocus] = useState<QuestFocus>(null);
	const focusQuest = questFocus?.questId ?? (drawerOpen ? selectedQuest : null);
	const focusObjective = questFocus?.objectiveId;
	const dimmed = useMemo(() => {
		if (!focusQuest) return undefined;
		return new Set(
			overlay
				.filter(
					(marker) =>
						marker.layer === QUEST_LAYER &&
						(marker.quest?.questId !== focusQuest ||
							(focusObjective !== undefined && marker.quest.objectiveId !== focusObjective)),
				)
				.map((marker) => marker.id),
		);
	}, [overlay, focusQuest, focusObjective]);
	const hoveredQuest = hovered ? (overlayById.get(hovered)?.quest?.questId ?? null) : null;
	const pinnedQuest = pinned ? (overlayById.get(pinned)?.quest?.questId ?? null) : null;
	// Unpinning a marker of the open quest (clicking it again, X, Escape) takes the drawer back to the list.
	const [lastPinnedQuest, setLastPinnedQuest] = useState(pinnedQuest);
	if (lastPinnedQuest !== pinnedQuest) {
		setLastPinnedQuest(pinnedQuest);
		if (!pinned && lastPinnedQuest && lastPinnedQuest === selectedQuest) {
			setSelectedQuest(null);
			setQuestFocus(null);
		}
	}
	/** From the drawer; leaving a quest also unpins its marker. */
	const selectQuest = (questId: string | null) => {
		if (pinnedQuest && pinnedQuest !== questId) setPinned(null);
		setSelectedQuest(questId);
		setQuestFocus(null);
	};
	const tapMarker = (id: string) => {
		const unpinning = pinned === id;
		setPinned(unpinning ? null : id);
		const questId = overlayById.get(id)?.quest?.questId;
		if (questId && !unpinning) {
			setDrawerOpen(true);
			setSelectedQuest(questId);
			setQuestFocus(null);
		}
	};
	// Showing an objective pins its marker (switching to its floor) and pans to it; again, to its next location.
	const showObjective = (questId: string, objectiveId: string) => {
		const spots = overlay.filter(
			(marker) => marker.quest?.questId === questId && marker.quest.objectiveId === objectiveId,
		);
		if (!spots.length) return;
		const current = spots.findIndex((marker) => marker.id === pinned);
		const next = spots[(current + 1) % spots.length];
		setPinned(next.id);
		map.current?.panToWorld(next.position);
	};
	const colors = useMemo(() => questColors(quests.active.map((quest) => quest.id)), [quests.active]);
	const markerGlyph = useCallback(
		(marker: MapMarker) =>
			marker.quest ? (
				<QuestMarkerGlyph type={marker.quest.type} color={colors.get(marker.quest.questId) ?? "var(--me-faint)"} />
			) : undefined,
		[colors],
	);

	// Floors: the chosen floor, or all floors (null). A pinned marker shows its own floor until unpinned.
	const floors = useMemo(() => (calibration?.layers.length ? floorsOf(calibration) : []), [calibration]);
	const [chosenFloor, setChosenFloor] = useState<FloorSelection>(null);
	const pinnedMarker = pinned ? overlayById.get(pinned) : undefined;
	const pinFloor =
		pinned && calibration && floors.length
			? (pinnedMarker ? floorOf(calibration, pinnedMarker) : baseFloor(calibration)).id
			: undefined;
	const shownFloor = calibration ? floorById(calibration, pinFloor ?? chosenFloor) : null;
	const floor: FloorSelection = shownFloor?.id ?? null;
	/** Picking a floor takes over from a pinned marker's floor; while split, it goes to the floor's column. */
	const chooseFloor = (id: FloorSelection) => {
		setPinned(null);
		if (split) map.current?.focusFloor(id);
		else setChosenFloor(id);
	};

	const label = mapName(mapKey) ?? mapKey;
	const loading = enabled && query.isPending;

	return (
		<MapAssetsContext.Provider value={explorerAssets}>
			<main className={`map-explorer ${drawerOpen ? "quests-open" : ""}`} aria-label={`${label} map`}>
				<TarkovMap
					ref={map}
					map={calibration}
					art={preferences.art}
					floor={floor}
					split={split}
					markers={shownOverlay}
					filters={filters}
					preset={explorerPreset}
					lootIcons={lootIcons}
					selected={pinned}
					dimmed={dimmed}
					markerGlyph={markerGlyph}
					onMarkerHover={setHovered}
					onMarkerTap={tapMarker}
				/>
				{(loading || query.isError) && (
					<div className="map-status" role="status">
						<div>
							{query.isError ? (
								<>
									<span>{query.error.message || "Map data could not be loaded"}</span>
									<button type="button" onClick={() => void query.refetch()}>
										Retry
									</button>
								</>
							) : (
								<span>Loading map markers…</span>
							)}
						</div>
					</div>
				)}

				<div className="map-left">
					<MapLayersPanel
						layers={layerDefs}
						filters={filters}
						defaults={defaults}
						counts={counts}
						open={preferences.layersOpen}
						onOpen={(layersOpen) => setPreferences({ layersOpen })}
						onChange={setFilters}
						collapsed={preferences.collapsed}
						onCollapse={(collapsed) => setPreferences({ collapsed })}
						presets={preferences.slots}
						onPresets={(slots) => setPreferences({ slots })}
						preset={explorerPreset}
						groupGlyph={legendGlyph}
					/>
					<div className="map-left-bottom">
						{floors.length > 0 && (
							<MapFloorPanel
								floors={floors.map((option) => ({ key: option.id, label: option.name }))}
								current={split ? null : floor}
								open={preferences.floorsOpen}
								onOpen={(floorsOpen) => setPreferences({ floorsOpen })}
								onSelect={chooseFloor}
							/>
						)}
						<div className="map-tools">
							<button
								type="button"
								className={`icon-button ${preferences.floorsOpen && floors.length ? "active" : ""}`}
								aria-pressed={preferences.floorsOpen}
								disabled={!floors.length}
								title={
									floors.length ? (preferences.floorsOpen ? "Hide floors" : "Show floors") : "This map has one floor"
								}
								onClick={() => setPreferences({ floorsOpen: !preferences.floorsOpen })}
							>
								<LayersIcon />
							</button>
							<button
								type="button"
								className={`icon-button ${split ? "active" : ""}`}
								aria-pressed={split}
								disabled={style === null || floors.length === 0}
								title={floors.length === 0 ? "This map has one floor" : split ? "Stack floors" : "Split floors apart"}
								onClick={() => setPreferences({ split: !preferences.split })}
							>
								<SplitIcon />
							</button>
							<button
								type="button"
								className={`icon-button ${style === "tiles" ? "active" : ""}`}
								aria-pressed={style === "tiles"}
								disabled={!(calibration?.svg && calibration.tilePath)}
								title={
									!(calibration?.svg && calibration.tilePath)
										? "Only one map style for this map"
										: style === "tiles"
											? "Show vector map"
											: "Show detailed tiles"
								}
								onClick={() => setPreferences({ art: style === "tiles" ? "svg" : "tiles" })}
							>
								<TerrainIcon />
							</button>
							<button
								type="button"
								className={`icon-button ${preferences.valuableLoot ? "active" : ""}`}
								aria-pressed={preferences.valuableLoot}
								title={
									preferences.valuableLoot
										? "Show loose loot as dots"
										: "Show each loose loot spot's most valuable item (loads prices)"
								}
								onClick={() => setPreferences({ valuableLoot: !preferences.valuableLoot })}
							>
								<CoinIcon />
							</button>
							<button type="button" className="icon-button" title="Zoom in" onClick={() => map.current?.zoomBy(1.5)}>
								<PlusIcon />
							</button>
							<button
								type="button"
								className="icon-button"
								title="Zoom out"
								onClick={() => map.current?.zoomBy(1 / 1.5)}
							>
								<MinusIcon />
							</button>
						</div>
					</div>
				</div>

				{cardMarker && (
					<MapMarkerCard
						marker={cardMarker}
						filters={filters}
						preset={explorerPreset}
						glyph={markerGlyph(cardMarker)}
						get={items.get}
						pinned={!!pinned}
						onClose={() => setPinned(null)}
						floorName={calibration && floors.length ? floorAt(calibration, cardMarker.position).name : undefined}
					/>
				)}

				<MapQuestDrawer
					open={drawerOpen}
					onOpen={setDrawerOpen}
					mapKey={mapKey}
					mapLabel={label}
					quests={quests.active}
					detailsById={quests.detailsById}
					items={quests.items}
					colors={colors}
					selected={selectedQuest}
					onSelect={selectQuest}
					highlighted={hoveredQuest}
					onHover={setQuestFocus}
					onShowObjective={showObjective}
					pending={quests.pending}
					error={quests.error}
					onRetry={quests.retry}
				/>

				<MapSwitcher
					current={mapKey}
					label={label}
					floor={shownFloor && !shownFloor.base ? shownFloor.name : undefined}
				/>
			</main>
		</MapAssetsContext.Provider>
	);
}
