import {
	bigint,
	boolean,
	check,
	foreignKey,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	primaryKey,
	text,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const modeCheck = (table: string, column = "mode") =>
	check(`${table}_${column}_check`, sql`${sql.raw(`\"${column}\"`)} in ('regular', 'pve', 'pvp-season')`);
const json = <T>(name: string) => jsonb(name).$type<T>();
const modes = ["regular", "pve", "pvp-season"] as const;

export const items = pgTable("items", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	normalizedName: text("normalized_name").notNull(),
	shortName: text("short_name"),
	iconLink: text("icon_link"),
	gridImageLink: text("grid_image_link"),
	image512pxLink: text("image_512px_link"),
	baseImageLink: text("base_image_link"),
	link: text("link"),
	wikiLink: text("wiki_link"),
});

export const itemModes = pgTable(
	"item_modes",
	{
		itemId: text("item_id")
			.notNull()
			.references(() => items.id, { onDelete: "cascade" }),
		mode: text("mode", { enum: modes }).notNull(),
		onFleaMarket: boolean("on_flea_market"),
		minLevelForFlea: integer("min_level_for_flea"),
		resourceUnits: numeric("resource_units"),
		category: json("category"),
		displayOverride: json("display_override"),
		sourceUpdatedAt: bigint("source_updated_at", { mode: "number" }),
	},
	(table) => [primaryKey({ columns: [table.itemId, table.mode] }), modeCheck("item_modes")],
);

export const traders = pgTable("traders", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	normalizedName: text("normalized_name").notNull(),
	imageLink: text("image_link"),
	image4xLink: text("image_4x_link"),
});
export const traderModes = pgTable(
	"trader_modes",
	{
		traderId: text("trader_id")
			.notNull()
			.references(() => traders.id, { onDelete: "cascade" }),
		mode: text("mode", { enum: modes }).notNull(),
		displayOverride: json("display_override"),
	},
	(table) => [primaryKey({ columns: [table.traderId, table.mode] }), modeCheck("trader_modes")],
);

export const stations = pgTable("stations", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	normalizedName: text("normalized_name").notNull(),
	imageLink: text("image_link"),
});
export const stationModes = pgTable(
	"station_modes",
	{
		stationId: text("station_id")
			.notNull()
			.references(() => stations.id, { onDelete: "cascade" }),
		mode: text("mode", { enum: modes }).notNull(),
		displayOverride: json("display_override"),
		sourceUpdatedAt: bigint("source_updated_at", { mode: "number" }),
	},
	(table) => [primaryKey({ columns: [table.stationId, table.mode] }), modeCheck("station_modes")],
);
export const stationLevels = pgTable(
	"station_levels",
	{
		stationId: text("station_id").notNull(),
		mode: text("mode", { enum: modes }).notNull(),
		level: integer("level").notNull(),
		levelId: text("level_id").notNull(),
		constructionTime: numeric("construction_time").notNull(),
		stationRequirements: json("station_requirements").notNull(),
		skillRequirements: json("skill_requirements").notNull(),
		traderRequirements: json("trader_requirements").notNull(),
		bonuses: json("bonuses"),
	},
	(table) => [
		primaryKey({ columns: [table.stationId, table.mode, table.level] }),
		foreignKey({
			columns: [table.stationId, table.mode],
			foreignColumns: [stationModes.stationId, stationModes.mode],
			name: "station_levels_variant_fk",
		}).onDelete("cascade"),
		modeCheck("station_levels"),
	],
);
export const stationItemRequirements = pgTable(
	"station_item_requirements",
	{
		stationId: text("station_id").notNull(),
		mode: text("mode", { enum: modes }).notNull(),
		level: integer("level").notNull(),
		requirementId: text("requirement_id").notNull(),
		itemId: text("item_id").notNull(),
		quantity: numeric("quantity").notNull(),
		foundInRaid: boolean("found_in_raid").notNull(),
		isTool: boolean("is_tool").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.stationId, table.mode, table.level, table.requirementId] }),
		foreignKey({
			columns: [table.stationId, table.mode, table.level],
			foreignColumns: [stationLevels.stationId, stationLevels.mode, stationLevels.level],
			name: "station_item_requirements_level_fk",
		}).onDelete("cascade"),
		index("station_item_requirements_mode_item_idx").on(table.mode, table.itemId),
		modeCheck("station_item_requirements"),
	],
);

export const skills = pgTable("skills", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	imageLink: text("image_link"),
});
export const skillModes = pgTable(
	"skill_modes",
	{
		skillId: text("skill_id")
			.notNull()
			.references(() => skills.id, { onDelete: "cascade" }),
		mode: text("mode", { enum: modes }).notNull(),
		displayOverride: json("display_override"),
	},
	(table) => [primaryKey({ columns: [table.skillId, table.mode] }), modeCheck("skill_modes")],
);

export const quests = pgTable("quests", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	normalizedName: text("normalized_name").notNull(),
	wikiLink: text("wiki_link"),
	taskImageLink: text("task_image_link"),
});
export const questModes = pgTable(
	"quest_modes",
	{
		questId: text("quest_id")
			.notNull()
			.references(() => quests.id, { onDelete: "cascade" }),
		mode: text("mode", { enum: modes }).notNull(),
		traderId: text("trader_id"),
		minPlayerLevel: integer("min_player_level"),
		experience: integer("experience").notNull(),
		factionName: text("faction_name"),
		kappaRequired: boolean("kappa_required"),
		lightkeeperRequired: boolean("lightkeeper_required"),
		removed: boolean("removed").notNull(),
		map: json("map"),
		displayOverride: json("display_override"),
		sourceUpdatedAt: bigint("source_updated_at", { mode: "number" }),
		objectives: json("objectives").notNull(),
		taskRequirements: json("task_requirements").notNull(),
		failConditions: json("fail_conditions").notNull(),
		traderRequirements: json("trader_requirements").notNull(),
		otherRequirements: json("other_requirements").notNull(),
		requiredPrestige: json("required_prestige"),
		rewardGroups: json("reward_groups").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.questId, table.mode] }),
		foreignKey({
			columns: [table.traderId, table.mode],
			foreignColumns: [traderModes.traderId, traderModes.mode],
			name: "quest_modes_trader_fk",
		}),
		index("quest_modes_mode_trader_idx").on(table.mode, table.traderId),
		modeCheck("quest_modes"),
	],
);

export const crafts = pgTable(
	"crafts",
	{
		id: text("id").notNull(),
		mode: text("mode", { enum: modes }).notNull(),
		productItemId: text("product_item_id").notNull(),
		productCount: numeric("product_count").notNull(),
		stationId: text("station_id").notNull(),
		level: integer("level").notNull(),
		duration: numeric("duration").notNull(),
		taskUnlockId: text("task_unlock_id"),
		requiredItems: json("required_items").notNull(),
		requiredQuestItems: json("required_quest_items").notNull(),
		gameEditions: json("game_editions").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.id, table.mode] }),
		index("crafts_mode_product_idx").on(table.mode, table.productItemId),
		index("crafts_mode_station_level_idx").on(table.mode, table.stationId, table.level),
		modeCheck("crafts"),
	],
);
export const barters = pgTable(
	"barters",
	{
		id: text("id").notNull(),
		mode: text("mode", { enum: modes }).notNull(),
		offeredItemId: text("offered_item_id").notNull(),
		offeredCount: numeric("offered_count").notNull(),
		traderId: text("trader_id").notNull(),
		minTraderLevel: integer("min_trader_level").notNull(),
		taskUnlockId: text("task_unlock_id"),
		buyLimit: numeric("buy_limit"),
		requiredItems: json("required_items").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.id, table.mode] }),
		index("barters_mode_offered_idx").on(table.mode, table.offeredItemId),
		index("barters_mode_trader_idx").on(table.mode, table.traderId),
		modeCheck("barters"),
	],
);

export const itemPrices = pgTable(
	"item_prices",
	{
		itemId: text("item_id").notNull(),
		mode: text("mode", { enum: modes }).notNull(),
		price: integer("price"),
		referencePrice: integer("reference_price"),
		latestPrice: integer("latest_price"),
		latestPriceMin: integer("latest_price_min"),
		latestOfferCount: integer("latest_offer_count"),
		latestPointAt: bigint("latest_point_at", { mode: "number" }),
		sampleCount: integer("sample_count").notNull().default(0),
		totalOfferCount: integer("total_offer_count").notNull().default(0),
		lastCheckedAt: bigint("last_checked_at", { mode: "number" }),
		avg24hPrice: numeric("avg_24h_price"),
		high24hPrice: integer("high_24h_price"),
		low24hPrice: integer("low_24h_price"),
		lastLowPrice: integer("last_low_price"),
		changeLast48h: numeric("change_last_48h"),
		changeLast48hPercent: numeric("change_last_48h_percent"),
		diff24h: numeric("diff_24h"),
		catalogAveragePrice: numeric("catalog_average_price"),
		catalogHighPrice: numeric("catalog_high_price"),
		catalogLowPrice: numeric("catalog_low_price"),
		catalogReferenceUpdatedAt: bigint("catalog_reference_updated_at", { mode: "number" }),
		traderPurchaseOffers: json("trader_purchase_offers").notNull().default([]),
		traderSellOffers: json("trader_sell_offers").notNull().default([]),
		recentPoints: json("recent_points").notNull().default([]),
		lastChangedAt: bigint("last_changed_at", { mode: "number" }),
	},
	(table) => [
		primaryKey({ columns: [table.itemId, table.mode] }),
		foreignKey({
			columns: [table.itemId, table.mode],
			foreignColumns: [itemModes.itemId, itemModes.mode],
			name: "item_prices_item_mode_fk",
		}).onDelete("cascade"),
		check(
			"item_prices_recent_points_check",
			sql`jsonb_typeof(${table.recentPoints}) = 'array' and jsonb_array_length(${table.recentPoints}) <= 10`,
		),
		check("item_prices_price_nonnegative_check", sql`${table.price} is null or ${table.price} >= 0`),
		modeCheck("item_prices"),
	],
);
export const itemPriceSync = pgTable(
	"item_price_sync",
	{
		itemId: text("item_id").notNull(),
		mode: text("mode", { enum: modes }).notNull(),
		etag: text("etag"),
		lastCheckedAt: bigint("last_checked_at", { mode: "number" }),
		consecutiveFailures: integer("consecutive_failures").notNull().default(0),
		lastError: text("last_error"),
	},
	(table) => [
		primaryKey({ columns: [table.itemId, table.mode] }),
		foreignKey({
			columns: [table.itemId, table.mode],
			foreignColumns: [itemModes.itemId, itemModes.mode],
			name: "item_price_sync_item_mode_fk",
		}).onDelete("cascade"),
		modeCheck("item_price_sync"),
	],
);

export const itemDiscovery = pgTable(
	"item_discovery",
	{
		itemId: text("item_id").notNull(),
		mode: text("mode", { enum: modes }).notNull(),
		firstSeenAt: bigint("first_seen_at", { mode: "number" }),
		firstSeenPatch: text("first_seen_patch"),
		legacyFirstSeenReleaseId: text("legacy_first_seen_release_id"),
	},
	(table) => [primaryKey({ columns: [table.itemId, table.mode] }), modeCheck("item_discovery")],
);
export const itemDetails = pgTable(
	"item_details",
	{
		itemId: text("item_id").notNull(),
		mode: text("mode", { enum: modes }).notNull(),
		relations: json("relations").notNull(),
		usage: json("usage").notNull(),
		acquisition: json("acquisition").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.itemId, table.mode] }),
		foreignKey({
			columns: [table.itemId, table.mode],
			foreignColumns: [itemModes.itemId, itemModes.mode],
			name: "item_details_item_mode_fk",
		}).onDelete("cascade"),
		modeCheck("item_details"),
	],
);
export const catalogStatus = pgTable(
	"catalog_status",
	{
		mode: text("mode", { enum: modes }).primaryKey(),
		contentVersion: bigint("content_version", { mode: "number" }).notNull().default(0),
		checkedAt: bigint("checked_at", { mode: "number" }),
		updatedAt: bigint("updated_at", { mode: "number" }),
		sourceFreshness: json("source_freshness").notNull().default({}),
		discoveryInitialized: boolean("discovery_initialized").notNull().default(false),
	},
	() => [modeCheck("catalog_status")],
);
export const priceRefreshState = pgTable(
	"price_refresh_state",
	{
		mode: text("mode", { enum: modes }).primaryKey(),
		leaseOwner: text("lease_owner"),
		leaseExpiresAt: bigint("lease_expires_at", { mode: "number" }),
		lastStartedAt: bigint("last_started_at", { mode: "number" }),
		lastCompletedAt: bigint("last_completed_at", { mode: "number" }),
		lastSummary: json("last_summary"),
	},
	() => [modeCheck("price_refresh_state")],
);

export const postgresSchema = {
	items,
	itemModes,
	traders,
	traderModes,
	stations,
	stationModes,
	stationLevels,
	stationItemRequirements,
	skills,
	skillModes,
	quests,
	questModes,
	crafts,
	barters,
	itemPrices,
	itemPriceSync,
	itemDiscovery,
	itemDetails,
	catalogStatus,
	priceRefreshState,
};
