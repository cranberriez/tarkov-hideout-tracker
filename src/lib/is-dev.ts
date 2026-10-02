/**
 * Single gate for development-only features (debug panels, dev routes, dev nav).
 * Next.js inlines NODE_ENV at build time, so gated code is removed from production bundles.
 */
export const isDev = process.env.NODE_ENV === "development";
