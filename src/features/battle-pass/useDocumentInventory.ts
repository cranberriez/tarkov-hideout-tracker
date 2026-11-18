"use client";

import { useState } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useBattlePassData, useBattlePassSave } from "./BattlePassSeason";
import { useProfileDocuments } from "./useProfileDocuments";
import { useBattlePassPreferences } from "./useBattlePassPreferences";
import type { SeasonId } from "@/lib/cfg/seasons";
import type { RewardConfiguration } from "./lib/battle-pass-configuration";
import { itemCountChange, type PlayerItemCounts } from "./lib/battle-pass-inventory";
import { normalizeCount, parseProgress, toggleId } from "./lib/battle-pass-model";
import { mergeDocumentProgress, prepareDocumentClaim } from "./lib/document-inventory-model";

type InventoryProfile = "PVP" | "PVE" | SeasonId;
const EMPTY_COUNTS: PlayerItemCounts = {};

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
export function useDocumentInventory(configuration: RewardConfiguration) {
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
	const [notice, setNotice] = useState("");
	return {
		profiles,
		selectedProfile,
		selectProfile: (key: string) => {
			setSelected(key as InventoryProfile);
			setNotice("");
		},
		available,
		progress: stored,
		preferences,
		setPreference,
		notice,
		setOwned: (key: string, value: number) => {
			const counts = countsFor(profileKey);
			const itemId = data.documentItemIds[key];
			if (!counts || !itemId) return;
			const change = itemCountChange(itemId, counts[itemId] ?? { have: 0, haveFir: 0 }, value);
			applyCount(profileKey, itemId, change.haveDelta, change.haveFirDelta);
		},
		setClassified: (value: number) => write((raw) => mergeDocumentProgress(raw, { classified: normalizeCount(value) })),
		toggleCollect: (key: string) =>
			write((raw) =>
				mergeDocumentProgress(raw, {
					avoidedDocuments: toggleId(parseProgress(raw).avoidedDocuments, key),
				}),
			),
		claim: (ids: string[], toggle = false) => {
			let changes: ReturnType<typeof prepareDocumentClaim>["changes"] = [];
			let unconfigured: string[] = [];
			let unclaimed = false;
			const counts = countsFor(profileKey);
			write((raw) => {
				const current = parseProgress(raw);
				if (toggle && current.completed.includes(ids[0])) {
					unclaimed = true;
					return mergeDocumentProgress(raw, { completed: current.completed.filter((id) => id !== ids[0]) });
				}
				const prepared = prepareDocumentClaim(
					current,
					counts ?? EMPTY_COUNTS,
					ids,
					data.tiles,
					configuration,
					data.documentItemIds,
					preferences.consumeDocs && !!counts,
					preferences.useClassified,
				);
				changes = prepared.changes;
				unconfigured = prepared.unconfigured;
				return mergeDocumentProgress(raw, {
					completed: prepared.progress.completed,
					...(prepared.progress.classified !== current.classified ? { classified: prepared.progress.classified } : {}),
				});
			});
			for (const change of changes) applyCount(profileKey, change.itemId, change.haveDelta, change.haveFirDelta);
			setNotice(
				unclaimed
					? ""
					: unconfigured.length
						? "Rewards marked claimed. No documents deducted: configure costs for every reward in this claim first."
						: preferences.consumeDocs && !counts
							? "Rewards marked claimed. No documents deducted: this seasonal character is not activated."
							: "",
			);
		},
	};
}
