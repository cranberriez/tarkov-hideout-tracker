/** Public canonical origin; preview and development hosts must never become canonicals. */
export const SITE_URL = "https://tarkovhideout.com";

export function isIndexableHost(host: string | null): boolean {
	return host === "tarkovhideout.com" || host === "www.tarkovhideout.com";
}

/** Production deployments only; previews and local builds stay `noindex`. Resolved at build time. */
export const IS_INDEXABLE_DEPLOYMENT = process.env.VERCEL_ENV === "production";
