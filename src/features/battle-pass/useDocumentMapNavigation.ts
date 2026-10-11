"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { useBattlePassData } from "./BattlePassSeason";
import {
	defaultDocumentMapSnapshot,
	documentMapHistoryState,
	documentMapUrl,
	readDocumentMapSnapshot,
	type DocumentMapSnapshot,
} from "./lib/battle-pass-map-navigation";

const isMapRoute = () => window.location.pathname === "/battle-pass/map";

/** Ephemeral display state belongs to the current browser history entry, never to player saves. */
export function useDocumentMapNavigation() {
	const { documentMaps, documents } = useBattlePassData();
	const routeMaps = useMemo(() => documentMaps.map((map) => ({ id: map.id, slug: map.slug })), [documentMaps]);
	const documentKeys = useMemo(() => documents.map((document) => document.key), [documents]);

	const readEntry = useCallback(
		() => readDocumentMapSnapshot(new URL(window.location.href), window.history.state, routeMaps, documentKeys),
		[routeMaps, documentKeys],
	);

	const writeEntry = useCallback(
		(snapshot: DocumentMapSnapshot, push: boolean) => {
			if (!isMapRoute()) return;
			const map = routeMaps.find((entry) => entry.id === snapshot.mapId);
			if (!map) return;
			const state = documentMapHistoryState(window.history.state, snapshot);
			const url = documentMapUrl(new URL(window.location.href), map);
			// Next supports native history updates and retains its internal router fields.
			if (push) window.history.pushState(state, "", url);
			else window.history.replaceState(state, "", url);
		},
		[routeMaps],
	);

	const [snapshot, setSnapshot] = useState(readEntry);
	const current = useRef(snapshot);
	useEffect(() => {
		// Initial state has already read this entry; never replace it with defaults on mount.
		writeEntry(current.current, false);
		const restore = () => {
			if (!isMapRoute()) return;
			const restored = readEntry();
			current.current = restored;
			setSnapshot(restored);
		};
		window.addEventListener("popstate", restore);
		return () => window.removeEventListener("popstate", restore);
	}, [readEntry, writeEntry]);

	const update = useCallback(
		<K extends "view" | "hiddenTypes" | "mapColors">(key: K, value: SetStateAction<DocumentMapSnapshot[K]>) => {
			const previous = current.current;
			const nextValue = typeof value === "function" ? value(previous[key]) : value;
			const next = { ...previous, [key]: nextValue };
			current.current = next;
			writeEntry(next, false);
			setSnapshot(next);
		},
		[writeEntry],
	);
	const setView = useCallback((value: SetStateAction<DocumentMapSnapshot["view"]>) => update("view", value), [update]);
	const setHiddenTypes = useCallback((value: SetStateAction<string[]>) => update("hiddenTypes", value), [update]);
	const setMapColors = useCallback((value: SetStateAction<boolean>) => update("mapColors", value), [update]);
	const changeMap = useCallback(
		(mapId: string) => {
			if (mapId === current.current.mapId || !routeMaps.some((map) => map.id === mapId)) return;
			const next = {
				...defaultDocumentMapSnapshot(mapId),
				hiddenTypes: current.current.hiddenTypes,
				mapColors: current.current.mapColors,
			};
			current.current = next;
			writeEntry(next, true);
			setSnapshot(next);
		},
		[routeMaps, writeEntry],
	);
	return { ...snapshot, setView, setHiddenTypes, setMapColors, changeMap };
}
