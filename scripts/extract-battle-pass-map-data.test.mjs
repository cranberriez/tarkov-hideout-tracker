import assert from "node:assert/strict";
import test from "node:test";
import { buildDataset, normalizePage, parseMapPage } from "./extract-battle-pass-map-data.mjs";

const value = (item) => [0, item];
const list = (items) => [1, items.map(value)];

function encodedObject(entries) {
	return Object.fromEntries(Object.entries(entries).map(([key, item]) => [key, value(item)]));
}

function makeSpot(overrides = {}) {
	return {
		id: "blueprint-3-1",
		type: "blueprints",
		layer: "main",
		floor: "3F",
		x: 64,
		y: 270,
		title: "3F Office Desk Drawer",
		description: "On the office desk.",
		key: null,
		images: ["/assets/previews/factory/blueprints/3-1.webp"],
		verified: true,
		url: "/maps/factory/3f-office-desk-drawer/",
		...overrides,
	};
}

function makePage(spots = [makeSpot()], overrides = {}) {
	return {
		map: {
			id: "factory",
			slug: "factory",
			name: "Factory",
			layers: [{ id: "main", image: "/assets/maps/factory.webp", width: 850, height: 850 }],
			floors: [{ id: "3F", name: "3rd floor", layer: "main" }],
			total: spots.filter((spot) => spot.type !== "transit").length,
			...overrides,
		},
		spots,
	};
}

function makeHtml(page) {
	const map = encodedObject({
		id: page.map.id,
		slug: page.map.slug,
		name: page.map.name,
		layers: list(page.map.layers.map((layer) => encodedObject(layer))),
		floors: list(page.map.floors.map((floor) => encodedObject(floor))),
		total: page.map.total,
	});
	const spots = list(page.spots.map((spot) => encodedObject(spot)));
	const props = JSON.stringify({ data: value({ map: value(map), spots }) })
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;");
	return `<astro-island props="${props}"></astro-island>`;
}

test("parses the Astro payload and keeps stable source ids with image-pixel coordinates", () => {
	const html = makeHtml(makePage());
	const parsed = parseMapPage(html, "factory");
	const normalized = normalizePage(parsed, "factory");
	assert.equal(normalized.map.width, 850);
	assert.equal(normalized.map.sourceUrl, "https://tarkovdoc.com/maps/factory/");
	assert.equal(normalized.spots[0].id, "blueprint-3-1");
	assert.equal(normalized.spots[0].sourceId, "blueprint-3-1");
	assert.equal(normalized.spots[0].x, 64);
	assert.equal(normalized.spots[0].y, 270);
	assert.equal(
		normalized.spots[0].screenshotUrls[0],
		"https://tarkovdoc.com/assets/previews/factory/blueprints/3-1.webp",
	);
});

test("normalizes PMC files to the personnel document key and permits records without a detail page", () => {
	const spot = makeSpot({
		id: "pmc-1",
		type: "pmc",
		title: "PMC document",
		floor: null,
		images: [],
		url: null,
		verified: false,
	});
	const normalized = normalizePage(makePage([spot]), "factory").spots[0];
	assert.equal(normalized.documentKey, "personnel");
	assert.equal(normalized.floor, null);
	assert.deepEqual(normalized.screenshotUrls, []);
	assert.equal(normalized.sourceUrl, null);
	assert.equal(normalized.verified, false);
});

test("rejects unknown document types and coordinates outside their native image layer", () => {
	assert.throws(() => normalizePage(makePage([makeSpot({ type: "unknown" })]), "factory"), /Unknown document type/);
	assert.throws(() => normalizePage(makePage([makeSpot({ x: 851 })]), "factory"), /Out-of-bounds coordinates/);
});

test("rejects duplicate stable ids and inconsistent partial source pages", () => {
	assert.throws(() => normalizePage(makePage([makeSpot(), makeSpot()], { total: 2 }), "factory"), /Duplicate spot id/);
	assert.throws(
		() => normalizePage(makePage([makeSpot(), makeSpot({ id: "blueprint-3-2" })], { total: 3 }), "factory"),
		/Partial locations for factory/,
	);
});

test("refuses an incomplete map set before writing a new dataset", () => {
	assert.throws(() => buildDataset([{ slug: "factory", html: makeHtml(makePage()) }]), /Missing source pages/);
});
