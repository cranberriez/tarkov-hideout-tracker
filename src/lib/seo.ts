/** Public canonical origin; preview and development hosts must never become canonicals. */
export const SITE_URL = "https://tarkovhideout.com";

export function isIndexableHost(host: string | null): boolean {
	return host === "tarkovhideout.com" || host === "www.tarkovhideout.com";
}
