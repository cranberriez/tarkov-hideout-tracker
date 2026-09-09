import type { CompactSearchManifest, SearchManifestPayload } from "../../types/search";
import type { TarkovJsonGameMode } from "../game-mode";
import type { ItemSummary } from "../../types/items";
import { normalizeName } from "../utils/normalize-name";
import { ResponseValidationError } from "../query/request";

const nonempty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const object = (value: unknown): value is Record<string, unknown> =>
	!!value && typeof value === "object" && !Array.isArray(value);

export function validateSearchManifest(value: unknown, mode: TarkovJsonGameMode): CompactSearchManifest {
	const fail = () => {
		throw new ResponseValidationError("Invalid compact search manifest");
	};
	if (!object(value) || value.v !== 1 || value.mode !== mode) return fail();
	for (const kind of ["items", "quests"] as const) {
		const rows = value[kind];
		if (!Array.isArray(rows) || !rows.length) return fail();
		const ids = new Set<string>();
		for (const row of rows) {
			if (!object(row) || !nonempty(row.id) || !nonempty(row.nn) || !nonempty(row.n) || ids.has(row.id)) return fail();
			ids.add(row.id);
			if (kind === "quests" && !nonempty(row.ti)) return fail();
			for (const key of ["sn", "ic"]) if (row[key] !== undefined && !nonempty(row[key])) return fail();
		}
	}
	if (!object(value.traders) || !Object.keys(value.traders).length) return fail();
	for (const [id, trader] of Object.entries(value.traders)) {
		if (!nonempty(id) || !object(trader) || !nonempty(trader.n) || (trader.ic !== undefined && !nonempty(trader.ic)))
			return fail();
	}
	const manifest = value as unknown as CompactSearchManifest;
	if (manifest.quests.some((quest) => !Object.hasOwn(manifest.traders, quest.ti))) return fail();
	return manifest;
}

export function decodeSearchManifest(value: unknown, mode: TarkovJsonGameMode, releaseId: string) {
	const manifest = validateSearchManifest(value, mode);
	if ((value as SearchManifestPayload).releaseId !== releaseId || !nonempty(releaseId)) {
		throw new ResponseValidationError("Search manifest release changed");
	}
	const items: ItemSummary[] = manifest.items.map(({ id, nn, n, sn, ic }) => ({
		id,
		normalizedName: nn,
		name: n,
		shortName: sn,
		iconLink: ic,
	}));
	const quests = manifest.quests.map(({ id, nn, n, ti }) => ({ id, normalizedName: nn, name: n, traderId: ti }));
	const traders = Object.fromEntries(
		Object.entries(manifest.traders).map(([id, trader]) => [id, { name: trader.n, iconLink: trader.ic }]),
	);
	return {
		mode,
		releaseId,
		items,
		quests,
		traders,
		itemIndex: items.map((item) => ({
			item,
			fields: [item.name, item.normalizedName, item.shortName ?? ""].map(normalizeName),
		})),
	};
}

export function searchManifestItems(
	index: ReturnType<typeof decodeSearchManifest>["itemIndex"],
	query: string,
	limit: number,
) {
	const normalized = normalizeName(query.trim());
	if (!normalized) return [];
	const compact = normalized.replaceAll("-", "");
	return index
		.filter(({ fields }) =>
			fields.some((field) => field.includes(normalized) || field.replaceAll("-", "").includes(compact)),
		)
		.sort(
			(a, b) =>
				Number(!a.fields.some((field) => field.startsWith(normalized))) -
					Number(!b.fields.some((field) => field.startsWith(normalized))) ||
				a.item.name.localeCompare(b.item.name, "en") ||
				a.item.id.localeCompare(b.item.id),
		)
		.slice(0, limit)
		.map(({ item }) => item);
}
