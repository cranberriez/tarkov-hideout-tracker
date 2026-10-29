/** Public page numbers are one-based; invalid links leave the default spread alone. */
export function parseBattlePassPage(value: string | string[] | undefined, pageCount: number): number | undefined {
	if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return undefined;
	const page = Number(value);
	return Number.isSafeInteger(page) && page <= pageCount ? page : undefined;
}

export function battlePassPageHref(page: number, seasonId?: string) {
	return `/battle-pass?page=${page}${seasonId ? `&season=${seasonId}` : ""}#pass-page-${page}`;
}

export function battlePassSpreadStart(page: number, pageCount: number, spread: number) {
	return Math.max(0, Math.min(page - 1, pageCount - spread));
}
