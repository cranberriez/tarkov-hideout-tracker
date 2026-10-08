import { sql } from "drizzle-orm";
import type { TarkovDataMode } from "@/types/common";
import type { HigherLowerItem, HigherLowerPageData } from "@/types/contracts";
import type { ItemPresetPart } from "@/types/items";
import { standardItemImageUrl } from "../../lib/utils/item-images";
import { getPostgresDb, type PostgresDatabase } from "../postgres/connection";
import { isMissingAnalyticsSchema } from "./market-analytics";

const PLACEHOLDER_IMAGE = "unknown-item";
/** Cheaper items crowd the bottom of the range with near-identical values. */
const MIN_ITEM_VALUE = 1000;

type Valued = { value: number; source: HigherLowerItem["source"] };

interface ValueRow {
	id: string;
	name: string;
	image512pxLink: string | null;
	types: string[];
	presetParts: ItemPresetPart[] | null;
	defaultPresetId: string | null;
	/** Latest 7-day median with medium or high confidence. */
	flea: number | null;
	/** Cheapest rouble trader purchase price. */
	trader: number | null;
}

function positiveNumber(value: unknown): number | null {
	const number = typeof value === "string" ? Number(value) : value;
	return typeof number === "number" && Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

/** Shown and compared values: nearest 1,000 ₽, or nearest 100/10 for smaller values. */
function roundValue(value: number): number {
	const step = value >= 1000 ? 1000 : value >= 100 ? 100 : 10;
	return Math.round(value / step) * step;
}

function readParts(value: unknown): ItemPresetPart[] | null {
	if (!Array.isArray(value) || !value.length) return null;
	const parts = value.filter(
		(part): part is ItemPresetPart =>
			typeof part?.itemId === "string" && Number.isInteger(part?.count) && part.count > 0,
	);
	return parts.length === value.length ? parts : null;
}

function toValueRow(row: Record<string, unknown>): ValueRow | null {
	if (typeof row.id !== "string" || typeof row.name !== "string" || !row.name) return null;
	return {
		id: row.id,
		name: row.name,
		image512pxLink: typeof row.image_512px_link === "string" ? row.image_512px_link : null,
		types: Array.isArray(row.item_types) ? row.item_types.filter((type) => typeof type === "string") : [],
		presetParts: readParts(row.preset_contents),
		defaultPresetId: typeof row.default_preset_id === "string" ? row.default_preset_id : null,
		flea: row.confidence === "high" || row.confidence === "medium" ? positiveNumber(row.median_7d) : null,
		trader: positiveNumber(row.trader_cost),
	};
}

function partCounts(parts: readonly ItemPresetPart[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const part of parts) counts.set(part.itemId, (counts.get(part.itemId) ?? 0) + part.count);
	return counts;
}

/**
 * Values one mode's items. Items take a confident flea median, else their cheapest rouble trader price. A gun's
 * flea price is its default build's, so guns are valued only through the flea. Presets without their own price
 * are estimated from parts: a gun build starts from its default build and adds the parts it adds and subtracts
 * the default parts it removes; other presets sum their parts. Any part without a value leaves the preset out.
 */
function createValuer(rows: ReadonlyMap<string, ValueRow>) {
	const unit = (row: ValueRow | undefined): Valued | null =>
		!row
			? null
			: row.flea !== null
				? { value: row.flea, source: "flea" }
				: row.trader !== null
					? { value: row.trader, source: "trader" }
					: null;

	const sum = (counts: ReadonlyMap<string, number>): number | null => {
		let total = 0;
		for (const [itemId, count] of counts) {
			const value = unit(rows.get(itemId))?.value;
			if (value === undefined) return null;
			total += value * count;
		}
		return total;
	};

	const defaultBuild = (gun: ValueRow): number | null =>
		gun.flea ?? (gun.defaultPresetId ? (unit(rows.get(gun.defaultPresetId))?.value ?? null) : null);

	const estimate = (preset: ValueRow, parts: readonly ItemPresetPart[]): number | null => {
		const gun = parts.map((part) => rows.get(part.itemId)).find((row) => row?.types.includes("gun"));
		const defaultParts = gun?.defaultPresetId ? rows.get(gun.defaultPresetId)?.presetParts : null;
		if (!gun || !defaultParts || gun.defaultPresetId === preset.id) return sum(partCounts(parts));
		const base = defaultBuild(gun);
		if (base === null) return null;
		const counts = partCounts(parts);
		const defaults = partCounts(defaultParts);
		const added = new Map<string, number>();
		const removed = new Map<string, number>();
		for (const id of new Set([...counts.keys(), ...defaults.keys()])) {
			const difference = (counts.get(id) ?? 0) - (defaults.get(id) ?? 0);
			if (difference > 0) added.set(id, difference);
			else if (difference < 0) removed.set(id, -difference);
		}
		const plus = sum(added);
		const minus = sum(removed);
		return plus === null || minus === null ? null : base + plus - minus;
	};

	return (row: ValueRow): Valued | null => {
		if (row.types.includes("gun")) return row.flea !== null ? { value: row.flea, source: "flea" } : null;
		const own = unit(row);
		if (own || !row.types.includes("preset") || !row.presetParts) return own;
		const value = estimate(row, row.presetParts);
		return value === null ? null : { value, source: "parts" };
	};
}

/**
 * Every playable item in one mode. Guns show their default preset's image, and a default preset is dropped
 * when its gun is playable. Values under MIN_ITEM_VALUE and placeholder images are left out.
 */
export async function getHigherLowerPageData(
	mode: TarkovDataMode,
	database: PostgresDatabase = getPostgresDb(),
): Promise<HigherLowerPageData> {
	try {
		// Every item in the mode is read because preset estimates need their parts' values.
		const result = await database.execute(sql`
			select items.id, items.name, items.image_512px_link, item_modes.item_types, item_modes.preset_contents,
				item_modes.default_preset_id, o.median_7d, o.confidence, rub.cost as trader_cost
			from item_modes
			join items on items.id = item_modes.item_id
			left join item_prices on item_prices.item_id = item_modes.item_id and item_prices.mode = item_modes.mode
			left join lateral (
				select median_7d, confidence from item_market_observations
				where mode = item_modes.mode and item_id = item_modes.item_id and item_modes.on_flea_market is true
				order by calculated_at desc
				limit 1
			) o on true
			left join lateral (
				select min((offer->>'priceRUB')::numeric) as cost
				from jsonb_array_elements(item_prices.trader_purchase_offers) offer
				where offer->>'currency' = 'RUB' and jsonb_typeof(offer->'priceRUB') = 'number'
			) rub on true
			where item_modes.mode = ${mode}`);
		const rows = new Map(result.rows.flatMap((row) => toValueRow(row) ?? []).map((row) => [row.id, row]));
		const valueOf = createValuer(rows);

		const playableDefaults = new Set<string>();
		const items: HigherLowerItem[] = [];
		for (const row of rows.values()) {
			const valued = valueOf(row);
			if (!valued || valued.value < MIN_ITEM_VALUE) continue;
			const preset = row.defaultPresetId ? rows.get(row.defaultPresetId) : undefined;
			const image = row.defaultPresetId
				? (preset?.image512pxLink ?? standardItemImageUrl(row.defaultPresetId, "512"))
				: row.image512pxLink;
			if (image?.includes(PLACEHOLDER_IMAGE)) continue;
			if (row.defaultPresetId) playableDefaults.add(row.defaultPresetId);
			items.push({
				id: row.id,
				name: row.name,
				value: roundValue(valued.value),
				source: valued.source,
				...(image && image !== standardItemImageUrl(row.id, "512") ? { image512pxLink: image } : {}),
			});
		}
		return { mode, items: items.filter((item) => !playableDefaults.has(item.id)), error: null };
	} catch (error) {
		// Missing analytics tables, or catalog columns before migration 0006.
		if (!isMissingAnalyticsSchema(error)) throw error;
		return { mode, items: [], error: "Item values need this server's market analytics and catalog migrations." };
	}
}
