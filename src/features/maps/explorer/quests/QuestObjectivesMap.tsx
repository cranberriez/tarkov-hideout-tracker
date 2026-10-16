"use client";

import "../map-explorer.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { FullQuest } from "@/types/quests";
import {
	baseFloor,
	defaultFilters,
	floorAt,
	floorById,
	floorOf,
	floorsOf,
	mapName,
	type PlayerPosition,
	resolveMap,
	TarkovMap,
	type FloorSelection,
	type MapMarker,
	type TarkovMapHandle,
} from "../../tarkov-map";
import { LayersIcon, MinusIcon, PlusIcon } from "../icons";
import { MapMarkerCard } from "../MapMarkerCard";
import { MapFloorPanel } from "../MapPanels";
import { FIRST_QUEST_COLOR, QuestMarkerGlyph } from "./QuestMarkerGlyph";
import { buildQuestMarkers, explorerPreset } from "./quest-map-markers";

const filters = defaultFilters("unknown", explorerPreset);
const noItems = () => undefined;

/**
 * A condensed map for one quest: its objective markers on one map, with floors and zoom. Loads no map data of its
 * own, only the art; markers come from the quest. Remount it per quest and map.
 */
export function QuestObjectivesMap({
	quest,
	mapKey,
	hoveredObjectiveId,
	focusedObjectiveId,
	focusRequestKey,
	onObjectiveSelect,
}: {
	quest: FullQuest;
	mapKey: string;
	/** An objective hovered in the quest's list: the other objectives' markers fade. */
	hoveredObjectiveId: string | null;
	/** An objective asked to be shown: its marker is pinned and centred, the next one on each further request. */
	focusedObjectiveId: string | null;
	focusRequestKey: number | null;
	/** The objective of the marker pinned by hand, or null once it is unpinned. */
	onObjectiveSelect: (objectiveId: string | null) => void;
}) {
	const visited = useUserStore((state) => state.completedQuestObjectives);
	const calibration = useMemo(() => resolveMap(mapKey), [mapKey]);
	const map = useRef<TarkovMapHandle>(null);
	const markers = useMemo(() => buildQuestMarkers([quest], mapKey, visited), [quest, mapKey, visited]);
	const fit = useMemo(() => markers.flatMap((marker) => [marker.position, ...(marker.outline ?? [])]), [markers]);
	const markersById = useMemo(() => new Map(markers.map((marker) => [marker.id, marker])), [markers]);

	const [hovered, setHovered] = useState<string | null>(null);
	const [pinned, setPinned] = useState<string | null>(null);
	useEffect(() => {
		if (!pinned) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setPinned(null);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [pinned]);

	// Showing an objective pins its marker and centres on it; asking again moves on to its next location.
	const [handledFocus, setHandledFocus] = useState<number | null>(null);
	const [centre, setCentre] = useState<{ key: string; point: PlayerPosition } | null>(null);
	if (focusRequestKey !== null && focusRequestKey !== handledFocus && focusedObjectiveId) {
		setHandledFocus(focusRequestKey);
		const spots = markers.filter((marker) => marker.quest?.objectiveId === focusedObjectiveId);
		if (spots.length) {
			const next = spots[(spots.findIndex((marker) => marker.id === pinned) + 1) % spots.length];
			setPinned(next.id);
			setCentre({ key: `${focusRequestKey}`, point: { ...next.position, key: next.id } });
		}
	}

	const dimmed = useMemo(
		() =>
			hoveredObjectiveId && markers.some((marker) => marker.quest?.objectiveId === hoveredObjectiveId)
				? new Set(
						markers.filter((marker) => marker.quest?.objectiveId !== hoveredObjectiveId).map((marker) => marker.id),
					)
				: undefined,
		[markers, hoveredObjectiveId],
	);
	const markerGlyph = useCallback(
		(marker: MapMarker) =>
			marker.quest ? <QuestMarkerGlyph type={marker.quest.type} color={FIRST_QUEST_COLOR} /> : undefined,
		[],
	);

	// A pinned marker shows its own floor until unpinned; picking a floor takes over.
	const floors = useMemo(() => (calibration?.layers.length ? floorsOf(calibration) : []), [calibration]);
	const [chosenFloor, setChosenFloor] = useState<FloorSelection>(null);
	const [floorsOpen, setFloorsOpen] = useState(false);
	const pinnedMarker = pinned ? markersById.get(pinned) : undefined;
	const pinFloor =
		pinned && calibration && floors.length
			? (pinnedMarker ? floorOf(calibration, pinnedMarker) : baseFloor(calibration)).id
			: undefined;
	const floor: FloorSelection = (calibration ? floorById(calibration, pinFloor ?? chosenFloor) : null)?.id ?? null;
	const chooseFloor = (id: FloorSelection) => {
		setPinned(null);
		setChosenFloor(id);
	};

	const cardMarker = markersById.get(pinned ?? hovered ?? "");

	return (
		<div className="absolute inset-0">
			<div className="map-explorer h-full w-full" aria-label={`${mapName(mapKey) ?? mapKey} objective map`}>
				<TarkovMap
					ref={map}
					map={calibration}
					floor={floor}
					centre={centre}
					fit={fit}
					markers={markers}
					filters={filters}
					preset={explorerPreset}
					selected={pinned}
					dimmed={dimmed}
					markerGlyph={markerGlyph}
					onMarkerHover={setHovered}
					onMarkerTap={(id) => {
						const unpinning = pinned === id;
						setPinned(unpinning ? null : id);
						onObjectiveSelect(unpinning ? null : (markersById.get(id)?.quest?.objectiveId ?? null));
					}}
				/>
				<div className="map-left" style={{ justifyContent: "flex-end" }}>
					<div className="map-left-bottom">
						{floors.length > 0 && (
							<MapFloorPanel
								floors={floors.map((option) => ({ key: option.id, label: option.name }))}
								current={floor}
								open={floorsOpen}
								onOpen={setFloorsOpen}
								onSelect={chooseFloor}
							/>
						)}
						<div className="map-tools">
							<button
								type="button"
								className={`icon-button ${floorsOpen && floors.length ? "active" : ""}`}
								aria-pressed={floorsOpen}
								disabled={!floors.length}
								title={floors.length ? (floorsOpen ? "Hide floors" : "Show floors") : "This map has one floor"}
								onClick={() => setFloorsOpen(!floorsOpen)}
							>
								<LayersIcon />
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
						get={noItems}
						pinned={!!pinned}
						onClose={() => setPinned(null)}
						floorName={calibration && floors.length ? floorAt(calibration, cardMarker.position).name : undefined}
					/>
				)}
			</div>
		</div>
	);
}
