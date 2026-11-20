import type { Metadata } from "next";
import type { SeasonId } from "@/lib/cfg/seasons";

/**
 * Link previews (Open Graph / Twitter cards) for season pages and their `?b=` build links.
 *
 * - `/og/<season>/<code>` renders the preview image; `GENERIC_PREVIEW_CODE` is the build-less card.
 *   Images never change for a given URL, so they are cached immutably; bump `PREVIEW_VERSION` when
 *   the card design changes so platforms fetch fresh images.
 * - Season pages stay static and point at the generic card. Link-preview bots requesting a build
 *   link are rewritten (next.config `beforeFiles`) to `/og-share/<season>`, a tiny HTML page whose
 *   tags point at the build's canonical image URL.
 */
export const PREVIEW_VERSION = "1";
export const GENERIC_PREVIEW_CODE = "_";
export const PREVIEW_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** Key-art colors (hex copies of the `--kord*` / `--untar*` tokens; the image renderer can't read CSS). */
export const PREVIEW_THEMES: Record<
	SeasonId,
	{ chipLabel: string; first: string; second: string; accent: string; surface: string }
> = {
	"season-1": { chipLabel: "Season 1", first: "KORD", second: "BREACH", accent: "#fbbf24", surface: "#17140c" },
	"season-2": { chipLabel: "Season 2", first: "UNTAR", second: "CONTROL", accent: "#3d8fe0", surface: "#141c24" },
};

export const isPreviewSeason = (value: string): value is SeasonId => Object.hasOwn(PREVIEW_THEMES, value);

/** Site-relative image path for a canonical build code ("" or the generic code → the generic card). */
export function previewImagePath(seasonId: SeasonId, code: string): string {
	return `/og/${seasonId}/${code || GENERIC_PREVIEW_CODE}?v=${PREVIEW_VERSION}`;
}

/** Static page metadata: the generic card, so the page itself stays prerendered. */
export function seasonPagePreviewMetadata(seasonId: SeasonId, title: string, description: string): Metadata {
	return {
		openGraph: {
			type: "website",
			siteName: "Tarkov Hideout",
			title,
			description,
			url: `/${seasonId}`,
			images: [{ url: previewImagePath(seasonId, ""), ...PREVIEW_IMAGE_SIZE, alt: title }],
		},
		twitter: { card: "summary_large_image", title, description },
	};
}
