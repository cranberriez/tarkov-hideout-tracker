import { sql } from "drizzle-orm";
import type { TarkovDataMode } from "@/types/common";
import type { TraderAlibiItemCount, TraderAlibiPageData } from "@/types/contracts";
import { TRADER_ALIBI_TRADER_IDS } from "../../lib/games/trader-alibi";
import { getPostgresDb, type PostgresDatabase } from "../postgres/connection";

const traderList = sql.join(
	TRADER_ALIBI_TRADER_IDS.map((id) => sql`${id}`),
	sql`, `,
);

function positiveNumber(value: unknown): number | null {
	const number = typeof value === "string" ? Number(value) : value;
	return typeof number === "number" && Number.isFinite(number) && number > 0 ? number : null;
}

function itemCount(itemId: unknown, count: unknown): TraderAlibiItemCount | null {
	const amount = positiveNumber(count);
	return typeof itemId === "string" && itemId && amount !== null ? { itemId, count: amount } : null;
}

/**
 * Objective types that make fair clues: hand-ins, kills, quest items, locations and stashes. Finding items,
 * trader/task/skill requirements and status objectives are left out; they are vague or name a trader or quest.
 */
const OBJECTIVE_TYPES = new Set([
	"giveItem",
	"shoot",
	"visit",
	"plantItem",
	"findQuestItem",
	"mark",
	"plantQuestItem",
	"useItem",
	"extract",
	"buildItem",
]);
/** Every trader name, so no objective text points at its giver (or at another trader). */
const TRADER_NAMES =
	/\b(Prapor|Therapist|Skier|Peacekeeper|Mechanic|Ragman|Jaeger|Fence|Lightkeeper|Ref|BTR Driver)('s)?\b/g;
/** Hand-in text that says nothing without its item. */
const GENERIC_HAND_IN = /^Hand over the (item|items)$/i;

function maskTraders(text: string): string {
	return text.replace(TRADER_NAMES, (_, __, possessive) => (possessive ? "a trader's" : "a trader"));
}

type ObjectiveClue = TraderAlibiPageData["objectives"][number];

function toObjectiveClues(traderId: string, objectives: unknown): ObjectiveClue[] {
	if (!Array.isArray(objectives)) return [];
	return objectives.flatMap((objective): ObjectiveClue[] => {
		if (!objective || typeof objective !== "object") return [];
		const { type, description, count, itemIds, foundInRaid, maps } = objective as Record<string, unknown>;
		if (typeof type !== "string" || !OBJECTIVE_TYPES.has(type)) return [];
		if (typeof description !== "string" || !description.trim()) return [];
		const items = Array.isArray(itemIds) ? itemIds.filter((id): id is string => typeof id === "string") : [];
		const singleItem = type === "giveItem" && new Set(items).size === 1 ? items[0] : undefined;
		if (type === "giveItem" && !singleItem && GENERIC_HAND_IN.test(description.trim())) return [];
		const text = maskTraders(description.trim());
		const mapNames = Array.isArray(maps)
			? [
					...new Set(
						maps.flatMap((map) => {
							const name = (map as { name?: unknown } | null)?.name;
							return typeof name === "string" ? [name.replace(/ 21\+$/, "")] : [];
						}),
					),
				].filter((name) => !text.includes(name))
			: [];
		return [
			{
				traderId,
				type,
				text,
				count: positiveNumber(count) ?? 1,
				...(singleItem ? { itemId: singleItem, foundInRaid: foundInRaid === true } : {}),
				maps: mapNames,
			},
		];
	});
}

function level(value: unknown): number {
	const number = positiveNumber(value);
	return number === null ? 1 : Math.round(number);
}

/** Quest objectives, barters and cash offers of the Trader Alibi traders in one mode. Malformed rows are skipped. */
export async function getTraderAlibiPageData(
	mode: TarkovDataMode,
	database: PostgresDatabase = getPostgresDb(),
): Promise<TraderAlibiPageData> {
	const [quests, barters, offers] = await Promise.all([
		database.execute(sql`
			select quest_modes.trader_id, quest_modes.objectives
			from quest_modes
			where quest_modes.mode = ${mode} and quest_modes.removed is false and quest_modes.trader_id in (${traderList})`),
		database.execute(sql`
			select barters.trader_id, barters.min_trader_level, barters.offered_item_id, barters.offered_count,
				(select json_agg(json_build_object('itemId', inputs.item_id, 'count', inputs.count) order by inputs.position)
					from barter_inputs inputs where inputs.barter_id = barters.id and inputs.mode = barters.mode) as inputs
			from barters
			where barters.mode = ${mode} and barters.trader_id in (${traderList})`),
		database.execute(sql`
			select item_prices.item_id, offer->>'traderId' as trader_id, offer->>'minTraderLevel' as min_trader_level
			from item_prices cross join jsonb_array_elements(item_prices.trader_purchase_offers) offer
			where item_prices.mode = ${mode} and offer->>'traderId' in (${traderList})`),
	]);
	return {
		mode,
		objectives: quests.rows.flatMap((row) =>
			typeof row.trader_id === "string" ? toObjectiveClues(row.trader_id, row.objectives) : [],
		),
		barters: barters.rows.flatMap((row) => {
			const output = itemCount(row.offered_item_id, row.offered_count);
			const inputs = Array.isArray(row.inputs)
				? row.inputs.map((input: { itemId?: unknown; count?: unknown }) => itemCount(input?.itemId, input?.count))
				: [];
			if (typeof row.trader_id !== "string" || !output || !inputs.length || inputs.some((input) => !input)) return [];
			return [
				{
					traderId: row.trader_id,
					level: level(row.min_trader_level),
					output,
					inputs: inputs as TraderAlibiItemCount[],
				},
			];
		}),
		offers: offers.rows.flatMap((row) =>
			typeof row.trader_id === "string" && typeof row.item_id === "string"
				? [{ traderId: row.trader_id, itemId: row.item_id, level: level(row.min_trader_level) }]
				: [],
		),
	};
}
