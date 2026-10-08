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

function level(value: unknown): number {
	const number = positiveNumber(value);
	return number === null ? 1 : Math.round(number);
}

/** Quests, barters and cash offers of the Trader Alibi traders in one mode. Malformed rows are skipped. */
export async function getTraderAlibiPageData(
	mode: TarkovDataMode,
	database: PostgresDatabase = getPostgresDb(),
): Promise<TraderAlibiPageData> {
	const [quests, barters, offers] = await Promise.all([
		database.execute(sql`
			select quest_modes.trader_id, quests.name
			from quest_modes join quests on quests.id = quest_modes.quest_id
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
		quests: quests.rows.flatMap((row) =>
			typeof row.trader_id === "string" && typeof row.name === "string" && row.name
				? [{ traderId: row.trader_id, name: row.name }]
				: [],
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
