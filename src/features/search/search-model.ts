import type { decodeSearchManifest } from "../../lib/search/manifest";
import { normalizeName } from "../../lib/utils/normalize-name";
import type { ItemSummary } from "../../types/items";

export type SearchResult =
	| { kind: "item"; id: string; name: string; iconLink?: string; item: ItemSummary; fields: string[] }
	| { kind: "quest"; id: string; name: string; iconLink?: string; trader: string; fields: string[] };

export function buildPaletteIndex(manifest: ReturnType<typeof decodeSearchManifest>): SearchResult[] {
	return [
		...manifest.itemIndex.map(({ item, fields }) => ({
			kind: "item" as const,
			id: item.id,
			name: item.name,
			iconLink: item.iconLink,
			item,
			fields,
		})),
		...manifest.quests.map((quest) => ({
			kind: "quest" as const,
			id: quest.id,
			name: quest.name,
			iconLink: manifest.traders[quest.traderId]?.iconLink,
			trader: manifest.traders[quest.traderId]?.name ?? "Unknown trader",
			fields: [quest.name, quest.normalizedName].map(normalizeName),
		})),
	];
}

export type SearchKind = SearchResult["kind"];

/** Consume one leading prefix; once scoped, subsequent prefixes are literal search text. */
export function parsePaletteInput(value: string, kind: SearchKind | null = null) {
	const prefix = kind ? null : value.match(/^\s*([iq]):\s*/i);
	return {
		kind: prefix ? ((prefix[1].toLowerCase() === "i" ? "item" : "quest") as SearchKind) : kind,
		query: prefix ? value.slice(prefix[0].length) : value,
	};
}

export function searchPalette(index: SearchResult[], query: string, kind: SearchKind | null = null) {
	const scoped = kind ? index.filter((entry) => entry.kind === kind) : index;
	const normalized = normalizeName(query.trim());
	if (!normalized)
		return kind ? [...scoped].sort((a, b) => a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id)) : [];
	const terms = normalized.split("-").filter(Boolean);
	if (!terms.length) return [];
	const score = (entry: SearchResult) =>
		entry.fields.some((field) => field === normalized)
			? 0
			: entry.fields.some((field) => field.startsWith(normalized))
				? 1
				: 2;
	return scoped
		.filter(({ fields }) => terms.every((term) => fields.some((field) => field.includes(term))))
		.sort(
			(a, b) =>
				score(a) - score(b) ||
				a.name.localeCompare(b.name, "en") ||
				a.kind.localeCompare(b.kind) ||
				a.id.localeCompare(b.id),
		);
}
