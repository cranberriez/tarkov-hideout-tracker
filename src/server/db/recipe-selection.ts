import "server-only";

import { getTableColumns, sql } from "drizzle-orm";
import { barters, crafts, barterInputs, craftInputs } from "@/server/postgres/schema";
import type { ItemAmountRef } from "@/types/recipes";

// Correlated aggregates use the recipe/mode primary keys and preserve source order.
// Explicit outer SQL names prevent Drizzle from stripping qualification in single-table selects.
// Selecting these expressions replaces the legacy JSON columns entirely.
export const craftSelection = {
	...getTableColumns(crafts),
	requiredItems: sql<ItemAmountRef[]>`(select coalesce(jsonb_agg(
		jsonb_strip_nulls(jsonb_build_object('itemId', i.item_id, 'count', i.count, 'isTool', i.is_tool))
		order by i.position), '[]'::jsonb) from ${craftInputs} i
		where i.craft_id = ${sql.raw('"crafts"."id"')} and i.mode = ${sql.raw('"crafts"."mode"')} and i.input_kind = 'item')`,
	requiredQuestItems: sql<ItemAmountRef[]>`(select coalesce(jsonb_agg(
		jsonb_strip_nulls(jsonb_build_object('itemId', i.item_id, 'count', i.count, 'isTool', i.is_tool))
		order by i.position), '[]'::jsonb) from ${craftInputs} i
		where i.craft_id = ${sql.raw('"crafts"."id"')} and i.mode = ${sql.raw('"crafts"."mode"')} and i.input_kind = 'quest')`,
};
export const barterSelection = {
	...getTableColumns(barters),
	requiredItems: sql<ItemAmountRef[]>`(select coalesce(jsonb_agg(
		jsonb_strip_nulls(jsonb_build_object('itemId', i.item_id, 'count', i.count, 'isTool', i.is_tool))
		order by i.position), '[]'::jsonb) from ${barterInputs} i
		where i.barter_id = ${sql.raw('"barters"."id"')} and i.mode = ${sql.raw('"barters"."mode"')})`,
};
