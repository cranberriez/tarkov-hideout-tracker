"use client";

import { useState } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useBattlePassData, useBattlePassSave } from "./BattlePassSeason";
import { useProfileDocuments } from "./useProfileDocuments";
import { useBattlePassPreferences } from "./useBattlePassPreferences";
import type { SeasonId } from "@/lib/cfg/seasons";
import { itemCountChange } from "./lib/battle-pass-inventory";
import { normalizeCount, parseProgress, toggleId } from "./lib/battle-pass-model";
import { mergeDocumentProgress } from "./lib/document-inventory-model";

type InventoryProfile = "PVP" | "PVE" | SeasonId;

function countsFor(profile: InventoryProfile) {
	const state = useUserStore.getState();
	return profile === "PVP" || profile === "PVE"
		? state.profiles[profile].itemCounts
		: state.seasonalProfiles[profile]?.itemCounts;
}

function applyCount(profile: InventoryProfile, itemId: string, have: number, fir: number) {
	const state = useUserStore.getState();
	if (profile === "PVP" || profile === "PVE") state.addItemCountsForProfile(profile, itemId, have, fir);
	else state.addItemCountsForSeason(profile, itemId, have, fir);
}

/** The viewed inventory is independent of the app's active character and route mode. */
export function useDocumentInventory() {
	const data = useBattlePassData();
	const { stored, write } = useBattlePassSave();
	const { profiles } = useProfileDocuments();
	const [preferences, setPreference] = useBattlePassPreferences();
	const mode = useUserStore((state) => state.gameMode);
	const [selected, setSelected] = useState<InventoryProfile | null>(null);
	const selectedKey = selected ?? (mode === "KORD" ? data.seasonId : mode);
	const selectedProfile = profiles.find((profile) => profile.key === selectedKey) ?? profiles[2];
	const profileKey = selectedProfile.key as InventoryProfile;
	const available = useUserStore(
		(state) => profileKey === "PVP" || profileKey === "PVE" || !!state.seasonalProfiles[profileKey],
	);
	// "All" is a view over every usable inventory; claims and the single-profile route still use selectedProfile.
	const [viewAll, setViewAll] = useState(false);
	const seasonalAvailable = useUserStore((state) => !!state.seasonalProfiles[data.seasonId]);
	const availableProfiles = profiles.filter((profile) => profile.key !== data.seasonId || seasonalAvailable);
	const combinedInventory: Record<string, number> = {};
	for (const profile of availableProfiles)
		for (const [key, count] of Object.entries(profile.inventory))
			combinedInventory[key] = (combinedInventory[key] ?? 0) + count;
	const setOwnedFor = (profile: string, key: string, value: number) => {
		const counts = countsFor(profile as InventoryProfile);
		const itemId = data.documentItemIds[key];
		if (!counts || !itemId) return;
		const change = itemCountChange(itemId, counts[itemId] ?? { have: 0, haveFir: 0 }, value);
		applyCount(profile as InventoryProfile, itemId, change.haveDelta, change.haveFirDelta);
	};
	return {
		profiles,
		selectedProfile,
		viewAll,
		availableProfiles,
		combinedInventory,
		selectProfile: (key: string) => {
			if (key === "all") setViewAll(true);
			else {
				setViewAll(false);
				setSelected(key as InventoryProfile);
			}
		},
		available,
		progress: stored,
		preferences,
		setPreference,
		setOwned: (key: string, value: number) => setOwnedFor(profileKey, key, value),
		setOwnedFor,
		setClassified: (value: number) => write((raw) => mergeDocumentProgress(raw, { classified: normalizeCount(value) })),
		toggleCollect: (key: string) =>
			write((raw) =>
				mergeDocumentProgress(raw, {
					avoidedDocuments: toggleId(parseProgress(raw).avoidedDocuments, key),
				}),
			),
		/** Records claims only; owned counts are maintained by the player and never deducted. */
		claim: (ids: string[], toggle = false) =>
			write((raw) => {
				const current = parseProgress(raw);
				if (toggle && current.completed.includes(ids[0]))
					return mergeDocumentProgress(raw, { completed: current.completed.filter((id) => id !== ids[0]) });
				const known = new Set(data.tiles.map((tile) => tile.id));
				const added = [...new Set(ids)].filter((id) => known.has(id) && !current.completed.includes(id));
				return added.length
					? mergeDocumentProgress(raw, { completed: [...current.completed, ...added] })
					: (raw ?? "{}");
			}),
	};
}
