import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { BuildPreviewCard, GenericPreviewCard, type PreviewModifier } from "@/features/seasons/BuildPreviewCard";
import { SEASON_MODIFIERS } from "@/features/seasons/modifiers";
import { builderTotals, canonicalBuild, decodeBuild } from "@/features/seasons/modifiers/builder";
import {
	PREVIEW_FORMATS,
	SEASON_PREVIEWS_ENABLED,
	TALL_FORMAT_PARAM,
	isPreviewSeason,
	previewImagePath,
	type PreviewFormat,
} from "@/features/seasons/share-preview";

/**
 * Link-preview image for one season build: `/og/<season>/<canonical code>` or `/og/<season>/_`.
 * The whole path and query must match `previewImagePath` exactly; anything else redirects to it.
 *
 * `&f=tall` selects the 4:3 Discord card. A URL's image never changes (the design version is in
 * `?v=`), so responses are cached immutably by browsers, platform crawlers and the Vercel CDN: each
 * unique build and format renders at most
 * once per deployment. Non-canonical or invalid codes redirect without rendering, so junk URLs
 * cost only a tiny invocation and share the canonical image's cache entry.
 */
const IMMUTABLE = "public, max-age=31536000, immutable";
const CACHE_HEADERS = {
	"Cache-Control": IMMUTABLE,
	"CDN-Cache-Control": IMMUTABLE,
	"Vercel-CDN-Cache-Control": IMMUTABLE,
};
const ICON_SIZE = 192;

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
	if (!SEASON_PREVIEWS_ENABLED || !isPreviewSeason(season)) return new Response("Not found", { status: 404 });
	const set = SEASON_MODIFIERS[season];
	const canonical = canonicalBuild(code, set.shareOrder);
	const search = new URL(request.url).searchParams;
	const format: PreviewFormat = search.get(TALL_FORMAT_PARAM) === "tall" ? "tall" : "wide";
	const expected = previewImagePath(season, canonical, format);
	if (`/og/${season}/${code}?${search}` !== expected) return redirect(request, expected);

	const personal = set.modifiers.filter(
		(modifier): modifier is typeof modifier & { kind: "positive" | "negative"; points: number } =>
			modifier.kind !== "global" && modifier.points !== undefined,
	);
	const options = { ...PREVIEW_FORMATS[format], headers: CACHE_HEADERS };
	if (!canonical) {
		return new ImageResponse(
			<GenericPreviewCard seasonId={season} format={format} modifierCount={personal.length} />,
			options,
		);
	}

	const selected = decodeBuild(canonical, set.shareOrder);
	// Positives first, then negatives, each in the season's list order.
	const picked = (["positive", "negative"] as const).flatMap((kind) =>
		personal.filter((modifier) => modifier.kind === kind && selected.has(modifier.id)),
	);
	const modifiers: PreviewModifier[] = picked.map(({ id, kind, name, points }) => ({ id, kind, name, points }));
	const icons = new Map(
		await Promise.all(
			picked.map(async (modifier) => [modifier.id, modifier.icon && (await loadIcon(modifier.icon))] as const),
		).then((entries) => entries.filter((entry): entry is [string, string] => Boolean(entry[1]))),
	);
	const totals = builderTotals(selected, Object.fromEntries(personal.map((modifier) => [modifier.id, modifier.points])));
	return new ImageResponse(
		<BuildPreviewCard seasonId={season} format={format} modifiers={modifiers} totals={totals} icons={icons} />,
		options,
	);
}
