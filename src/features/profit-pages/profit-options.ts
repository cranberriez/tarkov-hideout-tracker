import { normalizeCraftingSkillLevel } from "../../lib/price-calculation/crafting-skill";
import type { GameMode } from "@/lib/game-mode";

export interface ProfitOptions {
  craftingSkillLevel: number;
  availableOnly: boolean;
  profitableOnly: boolean;
  useTraderSaleForLockedOutputs: boolean;
  allowCrafts: boolean;
  allowBarters: boolean;
  lockFilters: {
    flea: boolean;
    quest: boolean;
    vendor: boolean;
    station: boolean;
  };
}

export const DEFAULT_PROFIT_OPTIONS: ProfitOptions = {
  craftingSkillLevel: 0,
  availableOnly: true,
  profitableOnly: false,
  useTraderSaleForLockedOutputs: true,
  allowCrafts: true,
  allowBarters: true,
  lockFilters: {
    flea: false,
    quest: false,
    vendor: false,
    station: false,
  },
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function parseProfitOptions(raw: string | null): ProfitOptions {
  let value: Record<string, unknown> = {};
  try {
    value = record(JSON.parse(raw ?? "null"));
  } catch {
    // Invalid saved options fall back to the existing defaults.
  }
  const options = {
    ...DEFAULT_PROFIT_OPTIONS,
    lockFilters: { ...DEFAULT_PROFIT_OPTIONS.lockFilters },
  };
  for (const key of [
    "availableOnly",
    "profitableOnly",
    "useTraderSaleForLockedOutputs",
    "allowCrafts",
    "allowBarters",
  ] as const) {
    if (typeof value[key] === "boolean") options[key] = value[key];
  }
  options.craftingSkillLevel = normalizeCraftingSkillLevel(value.craftingSkillLevel);
  const filters = record(value.lockFilters);
  for (const key of ["flea", "quest", "vendor", "station"] as const) {
    if (typeof filters[key] === "boolean") options.lockFilters[key] = filters[key];
  }
  return options;
}

export function profitOptionsStorageKey(mode: GameMode): string {
  return `tarkov-profit-options-v1:${mode}`;
}

export function createProfitOptionsStore(
  mode: GameMode,
  getStorage: () => Pick<Storage, "getItem" | "setItem">,
) {
  const key = profitOptionsStorageKey(mode);
  let snapshot = DEFAULT_PROFIT_OPTIONS;
  let lastRaw: string | null | undefined;

  function getSnapshot(): ProfitOptions {
    try {
      const raw = getStorage().getItem(key);
      if (raw !== lastRaw) {
        snapshot = parseProfitOptions(raw);
        lastRaw = raw;
      }
    } catch {
      // Keep session options usable when browser storage is unavailable.
    }
    return snapshot;
  }

  function setOption<K extends keyof ProfitOptions>(keyName: K, value: ProfitOptions[K]) {
    snapshot = { ...getSnapshot(), [keyName]: value };
    try {
      const raw = JSON.stringify(snapshot);
      getStorage().setItem(key, raw);
      lastRaw = raw;
    } catch {
      // Retain the edited snapshot for this visit if storage rejects the write.
    }
  }

  return { getSnapshot, setOption };
}
