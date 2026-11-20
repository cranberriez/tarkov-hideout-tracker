import { SEASON_MODIFIERS } from "@/features/seasons/modifiers";
import { BUILD_PARAM, builderTotals, canonicalBuild, decodeBuild } from "@/features/seasons/modifiers/builder";
import { formatPoints } from "@/features/seasons/modifiers/types";
import { PREVIEW_IMAGE_SIZE, PREVIEW_THEMES, isPreviewSeason, previewImagePath } from "@/features/seasons/share-preview";
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
	if (!isPreviewSeason(season)) return new Response("Not found", { status: 404 });
	const set = SEASON_MODIFIERS[season];
	const url = new URL(request.url);
	const code = canonicalBuild(url.searchParams.get(BUILD_PARAM), set.shareOrder);
	const seasonTitle = getSeason(season).title;
	const pageUrl = `${url.origin}/${season}${code ? `?${BUILD_PARAM}=${code}` : ""}`;

	let title: string = seasonTitle;
	let description = `Every ${seasonTitle} modifier, plus a point-budget build planner.`;
	if (code) {
		const selected = decodeBuild(code, set.shareOrder);
		const personal = set.modifiers.filter((modifier) => modifier.points !== undefined);
		const totals = builderTotals(selected, Object.fromEntries(personal.map((modifier) => [modifier.id, modifier.points!])));
		const names = (kind: string) =>
			personal
				.filter((modifier) => modifier.kind === kind && selected.has(modifier.id))
				.map((modifier) => modifier.name)
				.join(", ");
		const net = totals.balance === 0 ? "0" : formatPoints(totals.balance);
		title = `${seasonTitle} build · Granted +${totals.granted}, Spent −${totals.spent}, Net ${net}`;
		description = [
			names("positive") && `Positive: ${names("positive")}.`,
			names("negative") && `Negative: ${names("negative")}.`,
		]
			.filter(Boolean)
			.join(" ");
		if (description.length > 300) description = `${description.slice(0, 297)}…`;
	}
	const image = `${url.origin}${previewImagePath(season, code)}`;
	const tags = [
		["og:type", "website"],
		["og:site_name", "Tarkov Hideout"],
		["og:title", title],
		["og:description", description],
		["og:url", pageUrl],
		["og:image", image],
		["og:image:width", String(PREVIEW_IMAGE_SIZE.width)],
		["og:image:height", String(PREVIEW_IMAGE_SIZE.height)],
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
