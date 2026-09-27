/** Remove independently refreshed price values while retaining stored DTO shape. */
export function stripCatalogDto(value) {
	if (Array.isArray(value)) return value.map(stripCatalogDto);
	if (!value || typeof value !== "object") return value;
	const entries = Object.entries(value).filter(([key]) => !["marketPrice", "buyFromTrader"].includes(key));
	return Object.fromEntries(
		entries.map(([key, child]) => {
			if (key === "freshness" && child && typeof child === "object" && !Array.isArray(child)) {
				const freshness = Object.fromEntries(
					Object.entries(child).map(([domain, timestamp]) => [
						domain,
						domain.toLowerCase().includes("price") || timestamp === null || timestamp === undefined ? null : 0,
					]),
				);
				return [key, freshness];
			}
			return [key, stripCatalogDto(child)];
		}),
	);
}
