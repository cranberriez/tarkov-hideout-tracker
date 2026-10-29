/** Update only recipe focus, preserving query parameters and fragments. */
export function recipeFocusHref(href: string, recipeId: string | null): string {
	const url = new URL(href);
	if (recipeId === null) url.searchParams.delete("recipe");
	else url.searchParams.set("recipe", recipeId);
	return `${url.pathname}${url.search}${url.hash}`;
}
