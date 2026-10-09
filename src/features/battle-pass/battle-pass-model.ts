import snapshot from "../../lib/data/season-1-battle-pass.json";

export interface Reward {
	type: string;
	name?: string;
	value?: number;
	kind?: string;
	side?: string[];
	bsgId?: string;
	url?: string;
	trader?: string;
	level?: number;
}
export interface Tile {
	id: string;
	slot: number;
	displayName: string;
	img: string;
	bigImg: string;
	cost: Record<string, number>;
	totalDocumentCost: number;
	rewards: Reward[];
}
export interface PassPage {
	num: number;
	req: number;
	cells: Tile[];
}
export const pages: PassPage[] = snapshot.battlePass.pages.map((page) => ({
	...page,
	cells: page.cells.map((tile) => ({
		...tile,
		cost: Object.fromEntries(Object.entries(tile.cost).filter(([, amount]) => typeof amount === "number")),
	})),
}));
export const documents = snapshot.battlePass.documents;
export const tiles = pages.flatMap((page) => page.cells);
export const documentKeys = documents.map((doc) => doc.key);
export type Costs = Record<string, number>;
export const totalCost = (costs: Costs) => Object.values(costs).reduce((sum, amount) => sum + amount, 0);

export interface Progress {
	completed: string[];
	goals: string[];
	inventory: Costs;
	classified: number;
}
export const emptyProgress = (): Progress => ({ completed: [], goals: [], inventory: {}, classified: 0 });
export function normalizeCount(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(99999, Math.floor(value))) : 0;
}
export function parseProgress(raw: string | null): Progress {
	const result = emptyProgress();
	try {
		const value = JSON.parse(raw ?? "null");
		if (!value || typeof value !== "object" || Array.isArray(value)) return result;
		for (const field of ["completed", "goals"] as const) {
			if (Array.isArray(value[field]))
				result[field] = [...new Set<string>(value[field].filter((id: unknown) => typeof id === "string"))];
		}
		if (value.inventory && typeof value.inventory === "object" && !Array.isArray(value.inventory)) {
			result.inventory = Object.fromEntries(
				Object.entries(value.inventory).map(([key, amount]) => [key, normalizeCount(amount)]),
			);
		}
		result.classified = normalizeCount(value.classified);
	} catch {
		/* A corrupt save is not rewritten on read. */
	}
	return result;
}
export function toggleId(ids: string[], id: string) {
	return ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id];
}
export function sumCosts(selected: Tile[]): Costs {
	const costs: Costs = {};
	for (const tile of selected)
		for (const [key, amount] of Object.entries(tile.cost)) costs[key] = (costs[key] ?? 0) + amount;
	return costs;
}

/** Minimum total document count; inventory does not alter the optimization objective.
 * Each page is independent: keep explicit goals, then buy its cheapest remaining tiles
 * until the next page's count is met. A bundled reward still counts as one tile.
 */
export function planGoals(goalIds: string[], completedIds: string[], passPages = pages) {
	const known = new Set(passPages.flatMap((page) => page.cells.map((tile) => tile.id)));
	const completed = new Set(completedIds.filter((id) => known.has(id)));
	const goals = new Set(goalIds.filter((id) => known.has(id) && !completed.has(id)));
	const lastPage = passPages.findLastIndex((page) => page.cells.some((tile) => goals.has(tile.id)));
	const selected: Tile[] = [];
	const fillerIds: string[] = [];
	for (let i = 0; i <= lastPage; i++) {
		const page = passPages[i];
		const chosen = page.cells.filter((tile) => goals.has(tile.id));
		const done = page.cells.filter((tile) => completed.has(tile.id)).length;
		const required = i < lastPage ? passPages[i + 1].req : 0;
		const candidates = page.cells
			.filter((tile) => !completed.has(tile.id) && !goals.has(tile.id))
			.sort((a, b) => totalCost(a.cost) - totalCost(b.cost) || a.slot - b.slot);
		const fillers = candidates.slice(0, Math.max(0, required - done - chosen.length));
		selected.push(...chosen, ...fillers);
		fillerIds.push(...fillers.map((tile) => tile.id));
	}
	const costs = sumCosts(selected);
	return { selected, fillerIds, costs, total: totalCost(costs), unresolvedIds: goalIds.filter((id) => !known.has(id)) };
}

/** Allocate owned stock once to the entire plan, then a shared 1:1 wildcard pool. */
export function coverCosts(costs: Costs, inventory: Costs, classified: number, useClassified: boolean) {
	let pool = useClassified ? normalizeCount(classified) : 0;
	const rows = documentKeys.map((key) => {
		const required = costs[key] ?? 0;
		const owned = normalizeCount(inventory[key]);
		const used = Math.min(required, owned);
		const wildcard = Math.min(pool, required - used);
		pool -= wildcard;
		return { key, required, owned, used, classified: wildcard, missing: required - used - wildcard };
	});
	return {
		rows,
		missing: rows.reduce((n, row) => n + row.missing, 0),
		classifiedUsed: rows.reduce((n, row) => n + row.classified, 0),
		ownedUsed: rows.reduce((n, row) => n + row.used, 0),
	};
}

export function unlockedPages(completed: string[]) {
	const done = new Set(completed);
	let open = true;
	return pages.map((page, i) => {
		if (i > 0) open = open && pages[i - 1].cells.filter((tile) => done.has(tile.id)).length >= page.req;
		return open;
	});
}
