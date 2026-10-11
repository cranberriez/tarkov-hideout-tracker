"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getSeasonalCraftingSettings } from "@/lib/cfg/seasonal";
import { normalizeHideoutManagementSkillLevel } from "@/lib/price-calculation/craft-rules";
import type { GameMode } from "@/lib/game-mode";
import {
	createProfitOptionsStore,
	DEFAULT_PROFIT_OPTIONS,
	profitOptionsStorageKey,
	type ProfitOptions,
} from "./profit-options";

import { useUserStore } from "@/lib/stores/useUserStore";
import { useProfileStorageScope } from "@/lib/seasons/useProfileStorageScope";

const stores = new Map<string, ReturnType<typeof createProfitOptionsStore>>();
const CHANGE_EVENT = "tarkov-profit-options-change";
const getServerSnapshot = () => DEFAULT_PROFIT_OPTIONS;

function getStore(gameMode: GameMode | `KORD:${string}`) {
	let store = stores.get(gameMode);
	if (!store) {
		store = createProfitOptionsStore(gameMode, () => window.localStorage);
		stores.set(gameMode, store);
	}
	return store;
}

export function useProfitOptions(gameMode: GameMode) {
	const scope = useProfileStorageScope(gameMode);
	const seasonId = useUserStore((state) => state.selectedSeasonId);
	const store = getStore(scope);
	const subscribe = useCallback(
		(notify: () => void) => {
			function onStorage(event: StorageEvent) {
				if (event.key === null || event.key === profitOptionsStorageKey(scope)) {
					notify();
				}
			}
			window.addEventListener("storage", onStorage);
			window.addEventListener(CHANGE_EVENT, notify);
			return () => {
				window.removeEventListener("storage", onStorage);
				window.removeEventListener(CHANGE_EVENT, notify);
			};
		},
		[scope],
	);
	const options = useSyncExternalStore(subscribe, store.getSnapshot, getServerSnapshot);

	function setOption<K extends keyof ProfitOptions>(key: K, value: ProfitOptions[K]) {
		store.setOption(key, value);
		window.dispatchEvent(new Event(CHANGE_EVENT));
	}

	const seasonalCrafting = getSeasonalCraftingSettings(gameMode, options.craftingSkillLevel, seasonId);
	return {
		...options,
		...seasonalCrafting,
		setCraftingSkillLevel: (value: number) => {
			if (!seasonalCrafting.craftingSkillForced) setOption("craftingSkillLevel", value);
		},
		setHideoutManagementSkillLevel: (value: number) =>
			setOption("hideoutManagementSkillLevel", normalizeHideoutManagementSkillLevel(value)),
		setAvailableOnly: (value: boolean) => setOption("availableOnly", value),
		setProfitableOnly: (value: boolean) => setOption("profitableOnly", value),
		setShowTopOnly: (value: boolean) => setOption("showTopOnly", value),
		setTopCount: (value: number) => setOption("topCount", value),
		setIgnorePlayerLevel: (value: boolean) => setOption("ignorePlayerLevel", value),
		setUseTraderSaleForLockedOutputs: (value: boolean) => setOption("useTraderSaleForLockedOutputs", value),
		setPreferBestLockedRoute: (value: boolean) => setOption("preferBestLockedRoute", value),
		setAllowCrafts: (value: boolean) => setOption("allowCrafts", value),
		setAllowBarters: (value: boolean) => setOption("allowBarters", value),
		setLockFilters: (value: ProfitOptions["lockFilters"]) => setOption("lockFilters", value),
	};
}
