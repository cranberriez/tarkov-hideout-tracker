import { DEFAULT_TARKOV_JSON_GAME_MODE } from "../../lib/game-mode";
import { fetchTarkovJsonDataset, type TarkovJsonDataset, type TarkovJsonGameMode } from "./tarkovJson/client";
import type { ItemSummary, ItemCategory, TraderPurchaseOffer } from "@/types/items";
import type { CurrentPrice } from "@/types/prices";
import type { GlobalSkill } from "@/types/hideout";
import type { ItemsPayload, SkillsPayload } from "@/types/contracts";
import type { DataResult } from "@/types/common";
import { isOnFleaMarket } from "../../lib/utils/flea-eligibility";

interface JsonItemCategory {
	id: string;
	name: string;
	normalizedName: string;
}
interface JsonCatalogItem {
	id: string;
	name: string;
	normalizedName: string;
	shortName?: string;
	iconLink?: string;
	gridImageLink?: string;
	image512pxLink?: string;
	baseImageLink?: string;
	link?: string;
	wikiLink?: string;
	categories?: string[];
	minLevelForFlea?: number | null;
	avg24hPrice?: number | null;
	high24hPrice?: number | null;
	low24hPrice?: number | null;
	lastLowPrice?: number | null;
	lastOfferCount?: number | null;
	changeLast48hPercent?: number | null;
	lastScan?: string | null;
	types?: string[];
	properties?: { propertiesType?: unknown; units?: unknown } | null;
	buyFromTrader?: Array<{
		trader?: unknown;
		price?: unknown;
		priceRUB?: unknown;
		currency?: unknown;
		currencyItem?: unknown;
		minTraderLevel?: unknown;
		taskUnlock?: unknown;
		restockAmount?: unknown;
		buyLimit?: unknown;
	}>;
	sellToTrader?: Array<{
		trader: string;
		price: number;
		priceRUB: number;
		currency: string;
	}>;
}
interface JsonSkill {
	id: string;
	name: string;
	imageLink?: string;
}
interface JsonItemsData {
	items: Record<string, JsonCatalogItem>;
	itemCategories?: Record<string, JsonItemCategory>;
	skills?: JsonSkill[];
}
interface JsonTrader {
	id: string;
	name: string;
	normalizedName: string;
	imageLink?: string | null;
}
const itemDatasetRequests = new Map<TarkovJsonGameMode, Promise<TarkovJsonDataset<JsonItemsData>>>();

async function getItemsDataset(gameMode: TarkovJsonGameMode) {
	let request = itemDatasetRequests.get(gameMode);
	if (!request) {
		request = fetchTarkovJsonDataset<JsonItemsData>("items", gameMode);
		itemDatasetRequests.set(gameMode, request);
	}
	try {
		return await request;
	} finally {
		itemDatasetRequests.delete(gameMode);
	}
}

function numberOrNullish(value: unknown): number | null | undefined {
	if (value === null) return null;
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function validOptionalPrice(value: unknown): boolean {
	return value == null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

function validateMarketPriceInput(item: JsonCatalogItem): void {
	for (const field of ["avg24hPrice", "high24hPrice", "low24hPrice", "lastLowPrice", "lastOfferCount"] as const) {
		if (!validOptionalPrice(item[field])) throw new Error(`Tarkov JSON item ${item.id} contains an invalid ${field}`);
	}
	if (
		item.changeLast48hPercent != null &&
		(typeof item.changeLast48hPercent !== "number" || !Number.isFinite(item.changeLast48hPercent))
	) {
		throw new Error(`Tarkov JSON item ${item.id} contains an invalid changeLast48hPercent`);
	}
	if (item.lastScan != null && (typeof item.lastScan !== "string" || !Number.isFinite(Date.parse(item.lastScan)))) {
		throw new Error(`Tarkov JSON item ${item.id} contains an invalid lastScan timestamp`);
	}
	if (item.buyFromTrader != null && !Array.isArray(item.buyFromTrader)) {
		throw new Error(`Tarkov JSON item ${item.id} contains invalid trader purchase offers`);
	}
	if (item.sellToTrader != null && !Array.isArray(item.sellToTrader)) {
		throw new Error(`Tarkov JSON item ${item.id} contains invalid trader sale offers`);
	}
}

/** Fuel-tank style capacity; other property types and invalid values are omitted. */
function resourceUnits(item: JsonCatalogItem): { resourceUnits?: number } {
	const units = item.properties?.units;
	return item.properties?.propertiesType === "ItemPropertiesResource" &&
		typeof units === "number" &&
		Number.isFinite(units) &&
		units > 0
		? { resourceUnits: units }
		: {};
}

function mapTraderPurchaseOffer(value: unknown, itemId: string): TraderPurchaseOffer {
	const offer = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
	if (
		typeof offer.trader !== "string" ||
		!offer.trader ||
		typeof offer.price !== "number" ||
		!Number.isFinite(offer.price) ||
		offer.price < 0 ||
		typeof offer.priceRUB !== "number" ||
		!Number.isFinite(offer.priceRUB) ||
		offer.priceRUB < 0 ||
		typeof offer.currency !== "string" ||
		!offer.currency ||
		typeof offer.currencyItem !== "string" ||
		!offer.currencyItem ||
		typeof offer.minTraderLevel !== "number" ||
		!Number.isFinite(offer.minTraderLevel) ||
		offer.minTraderLevel < 0 ||
		(offer.restockAmount != null && !validOptionalPrice(offer.restockAmount)) ||
		(offer.buyLimit != null && !validOptionalPrice(offer.buyLimit))
	) {
		throw new Error(`Tarkov JSON item ${itemId} contains a malformed trader purchase offer`);
	}

	return {
		traderId: offer.trader,
		price: offer.price,
		priceRUB: offer.priceRUB,
		currency: offer.currency,
		currencyItemId: offer.currencyItem,
		minTraderLevel: offer.minTraderLevel,
		...(typeof offer.taskUnlock === "string" && offer.taskUnlock ? { taskUnlockId: offer.taskUnlock } : {}),
		restockAmount: numberOrNullish(offer.restockAmount),
		buyLimit: numberOrNullish(offer.buyLimit),
	};
}

function mapMarketPrice(
	item: JsonCatalogItem,
	traders: Record<string, JsonTrader>,
	translateTrader: (key: string | null | undefined) => string,
): CurrentPrice {
	const lastScan = item.lastScan ? Date.parse(item.lastScan) : Number.NaN;
	return {
		avg24hPrice: numberOrNullish(item.avg24hPrice),
		high24hPrice: numberOrNullish(item.high24hPrice),
		low24hPrice: numberOrNullish(item.low24hPrice),
		lastLowPrice: numberOrNullish(item.lastLowPrice),
		lastOfferCount: numberOrNullish(item.lastOfferCount),
		changeLast48hPercent: numberOrNullish(item.changeLast48hPercent),
		updatedAt: Number.isNaN(lastScan) ? null : lastScan,
		sellFor:
			item.sellToTrader == null
				? undefined
				: item.sellToTrader.map((value) => {
						const offer =
							typeof value === "object" && value !== null
								? value
								: ({} as NonNullable<JsonCatalogItem["sellToTrader"]>[number]);
						if (
							typeof offer.trader !== "string" ||
							!offer.trader ||
							typeof offer.priceRUB !== "number" ||
							!Number.isFinite(offer.priceRUB) ||
							offer.priceRUB < 0 ||
							(offer.price != null && !validOptionalPrice(offer.price)) ||
							(offer.currency != null && (typeof offer.currency !== "string" || !offer.currency))
						) {
							throw new Error(`Tarkov JSON item ${item.id} contains a malformed trader sale offer`);
						}
						const trader = traders[offer.trader];
						return {
							vendor: {
								id: offer.trader,
								name: translateTrader(trader?.name ?? offer.trader),
								normalizedName: trader?.normalizedName ?? offer.trader,
								imageLink: trader?.imageLink,
							},
							price: numberOrNullish(offer.price) ?? offer.priceRUB,
							currency: offer.currency,
							priceRUB: offer.priceRUB,
						};
					}),
	};
}

function mapItem(
	item: JsonCatalogItem,
	categories: Record<string, JsonItemCategory>,
	traders: Record<string, JsonTrader>,
	translateItem: (key: string | null | undefined) => string,
	translateTrader: (key: string | null | undefined) => string,
): ItemSummary | null {
	if (!item || typeof item.id !== "string" || !item.id.trim() || typeof item.name !== "string" || !item.name.trim())
		return null;
	validateMarketPriceInput(item);
	let category: ItemCategory | undefined;
	for (const categoryId of item.categories ?? []) {
		const sourceCategory = categories[categoryId];
		if (!sourceCategory) continue;
		category = {
			id: sourceCategory.id,
			name: translateItem(sourceCategory.name),
			normalizedName: sourceCategory.normalizedName,
		};
		break;
	}
	return {
		id: item.id,
		name: translateItem(item.name),
		normalizedName: item.normalizedName || item.id,
		shortName: item.shortName ? translateItem(item.shortName) : undefined,
		iconLink: item.iconLink,
		gridImageLink: item.gridImageLink,
		image512pxLink: item.image512pxLink,
		baseImageLink: item.baseImageLink,
		link: item.link,
		wikiLink: item.wikiLink,
		minLevelForFlea: numberOrNullish(item.minLevelForFlea),
		onFleaMarket: isOnFleaMarket(item.types ?? []),
		// Tarkov.dev orders the category path from the most specific leaf to
		// generic parents. Keep only the leaf; repeating every parent on every
		// item materially inflates all catalog cache and RSC payloads.
		category,
		...resourceUnits(item),
		...(item.buyFromTrader == null
			? {}
			: {
					buyFromTrader: item.buyFromTrader.map((offer) => mapTraderPurchaseOffer(offer, item.id)),
				}),
		marketPrice: mapMarketPrice(item, traders, translateTrader),
	};
}

/** Direct source reader used only while generating immutable database releases. */
export async function getGlobalItemList(
	gameMode: TarkovJsonGameMode = DEFAULT_TARKOV_JSON_GAME_MODE,
): Promise<DataResult<ItemsPayload>> {
	const [itemsDataset, tradersDataset] = await Promise.all([
		getItemsDataset(gameMode),
		fetchTarkovJsonDataset<Record<string, JsonTrader>>("traders", gameMode),
	]);
	const sourceItems = Object.values(itemsDataset.data.items ?? {});
	if (sourceItems.some((item) => !Array.isArray(item.types))) {
		throw new Error("Tarkov JSON item dataset omitted flea eligibility types");
	}
	const items = sourceItems.flatMap((item) => {
		const mapped = mapItem(
			item,
			itemsDataset.data.itemCategories ?? {},
			tradersDataset.data,
			itemsDataset.translate,
			tradersDataset.translate,
		);
		if (!mapped) throw new Error("Tarkov JSON item dataset contains an invalid required item record");
		return [mapped];
	});
	if (sourceItems.length === 0 || items.length === 0) {
		throw new Error("Global item mapping produced no items");
	}
	if (new Set(items.map((item) => item.id)).size !== items.length) {
		throw new Error("Tarkov JSON item dataset contains duplicate item IDs");
	}
	return {
		data: { items },
		updatedAt: Date.now(),
		diagnostics: {
			provider: "json",
			localePaths: [itemsDataset.locale.resolvedPath, tradersDataset.locale.resolvedPath],
			usedRegularLocaleFallback: itemsDataset.locale.usedRegularFallback || tradersDataset.locale.usedRegularFallback,
			upstreamStatus: "ok",
		},
	};
}

/** Skills share the `/items` source but remain a compact hideout-only projection. */
export async function getGlobalSkillList(
	gameMode: TarkovJsonGameMode = DEFAULT_TARKOV_JSON_GAME_MODE,
): Promise<DataResult<SkillsPayload>> {
	const dataset = await getItemsDataset(gameMode);
	const skills: GlobalSkill[] = (dataset.data.skills ?? []).flatMap((skill) =>
		typeof skill.id === "string" && skill.id
			? [{ id: skill.id, name: dataset.translate(skill.name), imageLink: skill.imageLink }]
			: [],
	);
	if (skills.length === 0) throw new Error("Tarkov JSON item dataset contained no skills");
	return {
		data: { skills },
		updatedAt: Date.now(),
		diagnostics: {
			provider: "json",
			localePaths: [dataset.locale.resolvedPath],
			usedRegularLocaleFallback: dataset.locale.usedRegularFallback,
			upstreamStatus: "ok",
		},
	};
}
