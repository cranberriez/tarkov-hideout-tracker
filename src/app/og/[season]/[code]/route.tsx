import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { SITE_URL } from "@/lib/seo";
import { BuildPreviewCard, GenericPreviewCard, type PreviewModifier } from "@/features/seasons/BuildPreviewCard";
import { SEASON_MODIFIERS } from "@/features/seasons/modifiers";
import { builderTotals, canonicalBuild, decodeBuild } from "@/features/seasons/modifiers/builder";
import {
	GENERIC_PREVIEW_CODE,
	PREVIEW_IMAGE_SIZE,
	PREVIEW_VERSION,
	isPreviewSeason,
	previewImagePath,
} from "@/features/seasons/share-preview";

/**
 * Link-preview image for one season build: `/og/<season>/<canonical code>` or `/og/<season>/_`.
 *
 * A URL's image never changes (the design version is in `?v=`), so responses are cached
 * immutably by browsers, platform crawlers and the Vercel CDN: each unique build renders at most
 * once per deployment. Non-canonical or invalid codes redirect without rendering, so junk URLs
 * cost only a tiny invocation and share the canonical image's cache entry.
 */
const IMMUTABLE = "public, max-age=31536000, immutable";
const CACHE_HEADERS = {
	"Cache-Control": IMMUTABLE,
	"CDN-Cache-Control": IMMUTABLE,
	"Vercel-CDN-Cache-Control": IMMUTABLE,
};
const SITE_HOST = new URL(SITE_URL).host;
const ICON_SIZE = 88;

/** Icon path → PNG data URI. Icons are bundled WebP (traced via next.config); converted once per instance. */
const iconCache = new Map<string, Promise<string | undefined>>();
function loadIcon(path: string): Promise<string | undefined> {
	let icon = iconCache.get(path);
	if (!icon) {
		icon = readFile(join(process.cwd(), "public", path))
			.then((file) => sharp(file).resize(ICON_SIZE, ICON_SIZE, { fit: "contain" }).png().toBuffer())
			.then((png) => `data:image/png;base64,${png.toString("base64")}`)
			.catch(() => undefined);
		iconCache.set(path, icon);
	}
	return icon;
}

function redirect(request: Request, path: string) {
	return new Response(null, {
		status: 308,
		headers: { Location: new URL(path, request.url).toString(), ...CACHE_HEADERS },
	});
}

export async function GET(request: Request, { params }: { params: Promise<{ season: string; code: string }> }) {
	const { season, code } = await params;
	if (!isPreviewSeason(season)) return new Response("Not found", { status: 404 });
	const set = SEASON_MODIFIERS[season];
	const canonical = canonicalBuild(code, set.shareOrder);
	const version = new URL(request.url).searchParams.get("v");
	if (code !== (canonical || GENERIC_PREVIEW_CODE) || version !== PREVIEW_VERSION) {
		return redirect(request, previewImagePath(season, canonical));
	}

	const personal = set.modifiers.filter((modifier) => modifier.kind !== "global" && modifier.points !== undefined);
	const options = { ...PREVIEW_IMAGE_SIZE, headers: CACHE_HEADERS };
	if (!canonical) {
		const count = (kind: string) => personal.filter((modifier) => modifier.kind === kind).length;
		return new ImageResponse(
			<GenericPreviewCard
				seasonId={season}
				host={SITE_HOST}
				positiveCount={count("positive")}
				negativeCount={count("negative")}
			/>,
			options,
		);
	}

	const selected = decodeBuild(canonical, set.shareOrder);
	const picked = personal.filter((modifier) => selected.has(modifier.id));
	const toPreview = (kind: string): PreviewModifier[] =>
		picked
			.filter((modifier) => modifier.kind === kind)
			.map(({ id, name, points, icon }) => ({ id, name, points: points!, icon }));
	const icons = new Map(
		await Promise.all(
			picked.map(async (modifier) => [modifier.id, modifier.icon && (await loadIcon(modifier.icon))] as const),
		).then((entries) => entries.filter((entry): entry is [string, string] => Boolean(entry[1]))),
	);
	const totals = builderTotals(selected, Object.fromEntries(personal.map((modifier) => [modifier.id, modifier.points!])));
	return new ImageResponse(
		<BuildPreviewCard
			seasonId={season}
			host={SITE_HOST}
			positive={toPreview("positive")}
			negative={toPreview("negative")}
			totals={totals}
			icons={icons}
		/>,
		options,
	);
}
