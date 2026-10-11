import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import snapshot from "../../../lib/data/battle-pass-map-data.json";
import backgrounds from "../../../lib/data/battle-pass-map-backgrounds.json";
import { localDocumentMapImage } from "./battle-pass-map-images";

test("every map layer, original fallback, replacement and location photo has a bundled image", () => {
	const sources = new Set([
		...snapshot.maps.flatMap((map) => [map.imageUrl, ...map.layers.map((layer) => layer.imageUrl)]),
		...snapshot.locations.flatMap((location) => location.screenshotUrls),
		...backgrounds.maps.flatMap((map) =>
			[map.imageUrl, map.sourceImageUrl].filter((url): url is string => Boolean(url)),
		),
	]);
	for (const source of sources) {
		const local = localDocumentMapImage(source);
		assert.ok(local.startsWith("/images/battle-pass/"), source);
		assert.ok(existsSync(resolve(process.cwd(), `public${local}`)), `Missing bundled image: ${source}`);
	}
	for (const map of snapshot.maps) {
		assert.ok(existsSync(resolve(process.cwd(), `public/images/battle-pass/maps/${map.slug}.webp`)), map.slug);
	}
});
