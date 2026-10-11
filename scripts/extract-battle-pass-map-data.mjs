import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE = "https://tarkovdoc.com/maps/";
const MAP_SLUGS = [
	"factory",
	"customs",
	"ground-zero",
	"interchange",
	"streets-of-tarkov",
	"reserve",
	"lighthouse",
	"shoreline",
	"woods",
	"the-lab",
	"the-labyrinth",
	"icebreaker",
];
const DOCUMENT_KEYS = new Set([
	"financial",
	"personnel",
	"project",
	"blueprints",
	"test",
	"user",
	"medical",
	"technical",
]);
const SOURCE_LICENSE =
	"Tarkovdoc map-page data; no content license is declared on the fetched pages. EFT map imagery, game names, and trademarks are © Battlestate Games.";

function sourceAssetUrl(value) {
	const url = new URL(value, "https://tarkovdoc.com");
	if (url.protocol !== "https:" || url.hostname !== "tarkovdoc.com") {
		throw new Error(`Unexpected source URL: ${value}`);
	}
	return url.href;
}

function decodeHtml(value) {
	return value
		.replace(/&quot;/g, '"')
		.replace(/&#34;/g, '"')
		.replace(/&#x22;/gi, '"')
		.replace(/&#39;|&#x27;/gi, "'")
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}

function deserializeAstro(value) {
	if (Array.isArray(value) && value.length === 2 && Number.isInteger(value[0])) {
		const [tag, payload] = value;
		switch (tag) {
			case 0:
				return deserializeAstro(payload);
			case 1:
				return deserializeAstro(payload);
			case 2:
				return new RegExp(payload);
			case 3:
				return new Date(payload);
			case 4:
				return new Map(deserializeAstro(payload));
			case 5:
				return new Set(deserializeAstro(payload));
			case 6:
				return BigInt(payload);
			case 7:
				return new URL(payload);
			case 8:
				return new Uint8Array(payload);
			case 9:
				return new Uint16Array(payload);
			case 10:
				return new Uint32Array(payload);
			default:
				throw new Error(`Unsupported Astro payload tag: ${tag}`);
		}
	}
	if (Array.isArray(value)) return value.map(deserializeAstro);
	if (value && typeof value === "object") {
		return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deserializeAstro(item)]));
	}
	return value;
}

export function parseMapPage(html, slug) {
	const island = html.match(/<astro-island\b[^>]*\bprops="([^"]*)"[^>]*>/i)?.[1];
	if (!island) throw new Error(`Missing Astro map data in ${slug}`);
	const props = JSON.parse(decodeHtml(island));
	const data = deserializeAstro(props.data);
	const map = data?.map;
	if (!map || !Array.isArray(map.layers) || !Array.isArray(data.spots)) {
		throw new Error(
			`Incomplete map data in ${slug} (data: ${Object.keys(data ?? {}).join(", ")}; map: ${Object.keys(map ?? {}).join(", ")})`,
		);
	}
	const mapSummary = data.maps?.find((entry) => entry.id === map.id) ?? {};
	return { map, mapSummary, spots: data.spots, allTypes: data.allTypes ?? {} };
}

function normalizeType(type) {
	const key = type === "pmc" ? "personnel" : type;
	if (!DOCUMENT_KEYS.has(key)) throw new Error(`Unknown document type: ${type}`);
	return key;
}

export function normalizePage(page, expectedSlug) {
	const { map, mapSummary = {}, spots } = page;
	if (!map.id || !map.name || map.slug !== expectedSlug || spots.length < 1) {
		throw new Error(`Missing required map fields for ${expectedSlug}`);
	}
	const layers = map.layers.map((layer) => {
		if (
			!layer.id ||
			!layer.image ||
			!Number.isFinite(layer.width) ||
			layer.width <= 0 ||
			!Number.isFinite(layer.height) ||
			layer.height <= 0
		) {
			throw new Error(`Invalid image layer on ${expectedSlug}`);
		}
		return {
			id: layer.id,
			name: layer.name ?? layer.id,
			imageUrl: sourceAssetUrl(layer.image),
			width: layer.width,
			height: layer.height,
		};
	});
	const mainLayer = layers.find((layer) => layer.id === "main") ?? layers[0];
	const seen = new Set();
	const normalizedSpots = spots
		.filter((spot) => spot.type !== "transit" && spot.type !== "temporary")
		.map((spot) => {
			if (!spot.id || !spot.title || !Array.isArray(spot.images)) {
				throw new Error(
					`Missing required spot fields in ${expectedSlug}: ${JSON.stringify({ id: spot?.id, title: spot?.title, images: spot?.images })}`,
				);
			}
			if (seen.has(spot.id)) throw new Error(`Duplicate spot id ${spot.id} in ${expectedSlug}`);
			seen.add(spot.id);
			const documentKey = normalizeType(spot.type);
			const layer = layers.find((candidate) => candidate.id === spot.layer);
			if (!layer || !Number.isFinite(spot.x) || !Number.isFinite(spot.y)) {
				throw new Error(`Missing coordinate or layer for ${spot.id}`);
			}
			if (spot.x < 0 || spot.y < 0 || spot.x > layer.width || spot.y > layer.height) {
				throw new Error(`Out-of-bounds coordinates for ${spot.id}`);
			}
			const screenshotUrls = spot.images.map(sourceAssetUrl);
			return {
				id: spot.id,
				mapId: map.id,
				documentKey,
				x: spot.x,
				y: spot.y,
				floor: spot.floor ?? null,
				layer: spot.layer,
				title: spot.title,
				description: spot.description ?? null,
				key: spot.key ?? null,
				screenshotUrls,
				verified: spot.verified ?? false,
				sourceId: spot.id,
				sourceUrl: spot.url ? sourceAssetUrl(spot.url) : null,
			};
		});
	const spawns = Object.fromEntries(
		Object.entries(mapSummary.spawns ?? map.spawns ?? {})
			.filter(([key]) => key !== "transit" && key !== "temporary")
			.map(([key, count]) => [key === "pmc" ? "personnel" : key, count]),
	);
	for (const key of Object.keys(spawns)) normalizeType(key);
	if (Number.isFinite(map.total) && normalizedSpots.length !== map.total) {
		throw new Error(`Partial locations for ${expectedSlug}: expected ${map.total}, received ${normalizedSpots.length}`);
	}
	return {
		map: {
			id: map.id,
			name: map.name,
			slug: map.slug,
			imageUrl: mainLayer.imageUrl,
			width: mainLayer.width,
			height: mainLayer.height,
			layers,
			floors: map.floors ?? [],
			spawns,
			total: map.total ?? normalizedSpots.length,
			sourceUrl: sourceAssetUrl(`/maps/${expectedSlug}/`),
			license: SOURCE_LICENSE,
			attribution: "EFT Docs Map. Escape from Tarkov map imagery and game assets © Battlestate Games.",
		},
		spots: normalizedSpots,
	};
}

export function buildDataset(rawPages) {
	const bySlug = new Map(rawPages.map(({ slug, html }) => [slug, html]));
	const absent = MAP_SLUGS.filter((slug) => !bySlug.has(slug) || !bySlug.get(slug));
	if (absent.length) throw new Error(`Missing source pages: ${absent.join(", ")}`);
	const pages = MAP_SLUGS.map((slug) => normalizePage(parseMapPage(bySlug.get(slug), slug), slug));
	const maps = pages.map(({ map }) => map);
	const locations = pages.flatMap(({ spots }) => spots);
	if (maps.length !== MAP_SLUGS.length || locations.length === 0) {
		throw new Error(`Partial source set: ${maps.length} maps and ${locations.length} spots`);
	}
	const ids = new Set();
	for (const spot of locations) {
		const compoundId = `${spot.mapId}/${spot.id}`;
		if (ids.has(compoundId)) throw new Error(`Duplicate stable spot id ${compoundId}`);
		ids.add(compoundId);
	}
	return {
		fetchedAt: new Date().toISOString(),
		source: {
			name: "EFT Docs Map",
			url: "https://tarkovdoc.com/maps/",
			season: "KORD BREACH",
			attribution: "EFT Docs Map. Escape from Tarkov map imagery and game assets © Battlestate Games.",
			license: SOURCE_LICENSE,
			coordinates: "Native top-left image pixels from each source map layer.",
			crossCheck: {
				name: "Perofunyang Battle Pass Interactive Map",
				url: "https://github.com/Perofunyang/battlepass_interactive_map",
				license: "CC BY-NC 4.0 for code and content; game imagery and trademarks remain Battlestate Games property.",
				note: "Full 12-map id, dimension, coordinate, document type, and preview-image-path parity was checked. Two temporary transit markers and Labyrinth blueprints-99 (source note: cannot loot) are excluded because they are not listed as document spawns by EFT Docs Map.",
			},
		},
		maps,
		locations,
	};
}

async function loadPages({ download, sourceDir }) {
	const pages = [];
	for (const slug of MAP_SLUGS) {
		let html;
		if (download) {
			const response = await fetch(new URL(`${slug}/`, SOURCE));
			if (!response.ok) throw new Error(`Could not fetch ${slug}: HTTP ${response.status}`);
			html = await response.text();
		} else {
			html = await readFile(resolve(sourceDir, `${slug}.html`), "utf8");
		}
		pages.push({ slug, html });
	}
	return pages;
}

export async function extract({
	download = false,
	sourceDir = "scripts/data/battle-pass/source-html",
	output = "src/lib/data/battle-pass-map-data.json",
} = {}) {
	const dataset = buildDataset(await loadPages({ download, sourceDir }));
	const outputPath = resolve(output);
	await mkdir(dirname(outputPath), { recursive: true });
	const tempPath = `${outputPath}.tmp`;
	await writeFile(tempPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
	await rename(tempPath, outputPath);
	return { outputPath, maps: dataset.maps.length, locations: dataset.locations.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	try {
		const result = await extract({ download: process.argv.includes("--download") });
		console.log(`Wrote ${result.locations} locations on ${result.maps} maps to ${result.outputPath}`);
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	}
}
