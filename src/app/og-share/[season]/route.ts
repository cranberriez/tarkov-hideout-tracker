import { SEASON_MODIFIERS } from "@/features/seasons/modifiers";
import { BUILD_PARAM, canonicalBuild, decodeBuild } from "@/features/seasons/modifiers/builder";
import {
	PREVIEW_FORMATS,
	PREVIEW_THEMES,
	SEASON_PREVIEWS_ENABLED,
	isPreviewSeason,
	previewImagePath,
	type PreviewFormat,
} from "@/features/seasons/share-preview";
import { getSeason } from "@/lib/cfg/seasons";

/**
 * Link-preview HTML for season build links, served only to unfurl bots: next.config rewrites
 * `/season-N?b=<code>` here when the User-Agent is a known link-preview crawler, so people and
 * search engines keep getting the static page. Reads no data; every value comes from the code.
 *
 * Not shared-cached on purpose: the response sits behind a User-Agent rewrite of a public page
 * URL, so a CDN entry keyed by that URL must never be served to people. It is tiny and cheap;
 * the expensive part (the image) is cached immutably on its own URL.
 */
const escapeHtml = (value: string) =>
	value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

export async function GET(request: Request, { params }: { params: Promise<{ season: string }> }) {
	const { season } = await params;
	if (!SEASON_PREVIEWS_ENABLED || !isPreviewSeason(season)) return new Response("Not found", { status: 404 });
	const set = SEASON_MODIFIERS[season];
	const url = new URL(request.url);
	const code = canonicalBuild(url.searchParams.get(BUILD_PARAM), set.shareOrder);
	const seasonTitle = getSeason(season).title;
	const pageUrl = `${url.origin}/${season}${code ? `?${BUILD_PARAM}=${code}` : ""}`;

	let title: string = seasonTitle;
	let description = `Every ${seasonTitle} modifier, plus a point-budget build planner.`;
	if (code) {
		const selected = decodeBuild(code, set.shareOrder);
		const count = (kind: string) =>
			set.modifiers.filter((modifier) => modifier.kind === kind && selected.has(modifier.id)).length;
		title = `${seasonTitle} build`;
		description = `${count("positive")} positive and ${count("negative")} negative modifiers.`;
	}
	// Discord keeps the image's aspect ratio, so it gets the taller card; others crop to 1.91:1.
	const format: PreviewFormat = request.headers.get("user-agent")?.includes("Discordbot") ? "tall" : "wide";
	const size = PREVIEW_FORMATS[format];
	const image = `${url.origin}${previewImagePath(season, code, format)}`;
	const tags = [
		["og:type", "website"],
		["og:site_name", "Tarkov Hideout"],
		["og:title", title],
		["og:description", description],
		["og:url", pageUrl],
		["og:image", image],
		["og:image:width", String(size.width)],
		["og:image:height", String(size.height)],
		["og:image:alt", title],
	]
		.map(([property, content]) => `<meta property="${property}" content="${escapeHtml(content)}">`)
		.concat(
			[
				["twitter:card", "summary_large_image"],
				["twitter:title", title],
				["twitter:description", description],
				["twitter:image", image],
				["description", description],
				// Discord colors the embed's side bar with theme-color.
				["theme-color", PREVIEW_THEMES[season].accent],
			].map(([name, content]) => `<meta name="${name}" content="${escapeHtml(content)}">`),
		)
		.join("\n");
	const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<link rel="canonical" href="${escapeHtml(`${url.origin}/${season}`)}">
${tags}
</head><body><a href="${escapeHtml(pageUrl)}">${escapeHtml(title)}</a></body></html>`;
	return new Response(html, {
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "private, max-age=3600",
		},
	});
}
