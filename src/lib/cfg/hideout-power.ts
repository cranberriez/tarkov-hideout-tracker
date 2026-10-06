/**
 * Hideout power and Bitcoin Farm constants that no data feed exposes. Slot counts, fuel
 * bonuses, tank capacity and the Bitcoin craft duration come from the catalog instead.
 * Bitcoin Farm and Physical Bitcoin IDs live in price-calculation/craft-rules.
 */
import { STATION_IDS } from "../data/static-stations";

export const GENERATOR_STATION_ID = STATION_IDS.generator;
export const SOLAR_POWER_STATION_ID = STATION_IDS["solar-power"];
export const GRAPHICS_CARD_ITEM_ID = "57347ca924597744596b4e71";
export const METAL_FUEL_TANK_ITEM_ID = "5d1b36a186f7742523398433";
export const EXPEDITIONARY_FUEL_TANK_ITEM_ID = "5d1b371186f774253763a656";
export const FUEL_TANK_ITEM_IDS = [METAL_FUEL_TANK_ITEM_ID, EXPEDITIONARY_FUEL_TANK_ITEM_ID] as const;

/**
 * Seconds per coin with one graphics card (Tarkov JSON craft 5d5c205bd582a50d042a3c0e, all
 * modes, 2026-09-28). Ingestion drops passive Bitcoin production from the craft graph, so the
 * duration is kept here; it changed once (145,000 → 300,000) in recent years.
 */
export const BITCOIN_BASE_DURATION_SECONDS = 300_000;
/** Production boost per graphics card beyond the first (matches tarkov.dev's calculator). */
export const BITCOIN_GPU_BOOST = 0.041225;
/** The farm stops producing once this many coins wait for collection. */
export const BITCOIN_STORAGE_CAP = 3;
/** Base generator burn: 100 units per 75,789 s (~4.75/h), regardless of active stations. */
export const BASE_FUEL_UNITS_PER_HOUR = (100 / 75_789) * 3600;
