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
import { applyClaims, parseClaimDeductions, type ClaimRow } from "./lib/claim-deduction-model";
import type { Costs } from "./lib/battle-pass-model";

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
	const { stored, raw, write } = useBattlePassSave();
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
		/** Records claims only, without deducting documents. Unchecking a claim that deducted documents refunds them. */
		claim: (ids: string[], toggle = false): ClaimWriteResult => {
			const deductions = parseClaimDeductions(raw);
			if (toggle && stored.completed.includes(ids[0]) && deductions[ids[0]]) return refund(ids[0]);
			write((raw) => {
				const current = parseProgress(raw);
				const recorded = parseClaimDeductions(raw);
				if (toggle && current.completed.includes(ids[0]))
					return mergeDocumentProgress(raw, { completed: current.completed.filter((id) => id !== ids[0]) });
				const known = new Set(data.tiles.map((tile) => tile.id));
				const added = [...new Set(ids)].filter((id) => known.has(id) && !current.completed.includes(id));
				// A claim recorded without deducting has nothing to refund later.
				for (const id of added) delete recorded[id];
				return added.length
					? mergeDocumentProgress(raw, { completed: [...current.completed, ...added], claimDeductions: recorded })
					: (raw ?? "{}");
			});
			return { ok: true };
		},
		/** Record claims and remove the documents they consumed, undoing every change if any write fails. */
		claimWithDocuments: (rows: (ClaimRow & { have: Costs })[]): ClaimWriteResult => {
			const inventories = Object.fromEntries(profiles.map((profile) => [profile.key, profile.inventory]));
			const outcome = applyClaims(rows, inventories, stored.classified);
			if (outcome.classifiedShort > 0)
				return { ok: false, message: `${outcome.classifiedShort} more classified documents are needed.`, undone: true };
			const targets = Object.entries(outcome.inventories).flatMap(([profile, counts]) =>
				Object.entries(counts)
					.filter(([key, total]) => total !== (inventories[profile]?.[key] ?? 0))
					.map(([key, total]) => ({ profile, key, total })),
			);
			const ids = rows.map((row) => row.rewardId);
			const used = Object.values(outcome.deductions).reduce((sum, entry) => sum + entry.classified, 0);
			return transaction(targets, (raw) => {
				const current = parseProgress(raw);
				const recorded = parseClaimDeductions(raw);
				for (const id of ids) delete recorded[id];
				return mergeDocumentProgress(raw, {
					completed: [...current.completed, ...ids.filter((id) => !current.completed.includes(id))],
					classified: Math.max(0, current.classified - used),
					claimDeductions: { ...recorded, ...outcome.deductions },
				});
			});
		},
	};

	/** Put back what a recorded claim removed and uncheck it. */
	function refund(rewardId: string): ClaimWriteResult {
		const entry = parseClaimDeductions(raw)[rewardId];
		const owned = profiles.find((profile) => profile.key === entry.profileKey)?.inventory ?? {};
		const targets = Object.entries(entry.documents).map(([key, amount]) => ({
			profile: entry.profileKey,
			key,
			total: (owned[key] ?? 0) + amount,
		}));
		return transaction(targets, (raw) => {
			const current = parseProgress(raw);
			const recorded = parseClaimDeductions(raw);
			const classified = recorded[rewardId]?.classified ?? 0;
			delete recorded[rewardId];
			return mergeDocumentProgress(raw, {
				completed: current.completed.filter((id) => id !== rewardId),
				classified: current.classified + classified,
				claimDeductions: recorded,
			});
		});
	}

	/** Set document totals, then save the pass, checking each write; on failure restore both. */
	function transaction(
		targets: { profile: string; key: string; total: number }[],
		patch: (raw: string | null) => string,
	): ClaimWriteResult {
		const items = targets.map((target) => {
			const itemId = data.documentItemIds[target.key];
			const counts = countsFor(target.profile as InventoryProfile);
			return { ...target, itemId, before: counts && itemId ? { ...(counts[itemId] ?? ZERO) } : null };
		});
		let before: string | null = null;
		let wrote = false;
		try {
			for (const item of items) {
				if (!item.before) throw new Error("A claiming profile's inventory is not available.");
				setOwnedFor(item.profile, item.key, item.total);
				if (documentTotal(item.profile, item.itemId) !== item.total) throw new Error("The inventory did not update.");
			}
			let next = "";
			write((raw) => {
				before = raw;
				wrote = true;
				next = patch(raw);
				return next;
			});
			if (readStored(data.storageKey) !== next) throw new Error("The claim could not be saved.");
			return { ok: true };
		} catch (error) {
			let undone = true;
			for (const item of items) {
				if (!item.before) continue;
				try {
					const now = countsFor(item.profile as InventoryProfile)?.[item.itemId] ?? ZERO;
					applyCount(
						item.profile as InventoryProfile,
						item.itemId,
						item.before.have - now.have,
						item.before.haveFir - now.haveFir,
					);
					const restored = countsFor(item.profile as InventoryProfile)?.[item.itemId] ?? ZERO;
					if (restored.have !== item.before.have || restored.haveFir !== item.before.haveFir) undone = false;
				} catch {
					undone = false;
				}
			}
			if (wrote) {
				try {
					const restored = before ?? "{}";
					write(() => restored);
					if (readStored(data.storageKey) !== restored) undone = false;
				} catch {
					undone = false;
				}
			}
			return { ok: false, message: error instanceof Error ? error.message : "The claim failed.", undone };
		}
	}
}

export type ClaimWriteResult = { ok: true } | { ok: false; message: string; undone: boolean };

const ZERO = { have: 0, haveFir: 0 };

function documentTotal(profile: string, itemId: string) {
	const counts = countsFor(profile as InventoryProfile)?.[itemId] ?? ZERO;
	return Math.max(0, counts.have) + Math.max(0, counts.haveFir);
}

/** The persisted pass save, bypassing the in-memory fallback, to confirm a write reached storage. */
function readStored(key: string) {
	try {
		return window.localStorage.getItem(key);
	} catch {
		return undefined;
	}
}
