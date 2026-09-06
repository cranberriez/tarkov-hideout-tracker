"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { GameMode } from "@/lib/game-mode";
import {
  createProfitOptionsStore,
  DEFAULT_PROFIT_OPTIONS,
  profitOptionsStorageKey,
  type ProfitOptions,
} from "./profit-options";

const stores = new Map<GameMode, ReturnType<typeof createProfitOptionsStore>>();
const CHANGE_EVENT = "tarkov-profit-options-change";
const getServerSnapshot = () => DEFAULT_PROFIT_OPTIONS;

function getStore(gameMode: GameMode) {
  let store = stores.get(gameMode);
  if (!store) {
    store = createProfitOptionsStore(gameMode, () => window.localStorage);
    stores.set(gameMode, store);
  }
  return store;
}

export function useProfitOptions(gameMode: GameMode) {
  const store = getStore(gameMode);
  const subscribe = useCallback((notify: () => void) => {
    function onStorage(event: StorageEvent) {
      if (event.key === null || event.key === profitOptionsStorageKey(gameMode)) {
        notify();
      }
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGE_EVENT, notify);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHANGE_EVENT, notify);
    };
  }, [gameMode]);
  const options = useSyncExternalStore(subscribe, store.getSnapshot, getServerSnapshot);

  function setOption<K extends keyof ProfitOptions>(key: K, value: ProfitOptions[K]) {
    store.setOption(key, value);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return {
    ...options,
    setAvailableOnly: (value: boolean) => setOption("availableOnly", value),
    setProfitableOnly: (value: boolean) => setOption("profitableOnly", value),
    setUseTraderSaleForLockedOutputs: (value: boolean) =>
      setOption("useTraderSaleForLockedOutputs", value),
    setAllowCrafts: (value: boolean) => setOption("allowCrafts", value),
    setAllowBarters: (value: boolean) => setOption("allowBarters", value),
    setLockFilters: (value: ProfitOptions["lockFilters"]) => setOption("lockFilters", value),
  };
}
