import assert from "node:assert/strict";
import test from "node:test";
import { detectItemFootprints } from "./item-footprints";
import type { ItemDetection } from "./recognition-model";
import { seedReviewBoxes } from "./review-model";

test("visible borders enclose wide and tall items despite short labels", () => {
	const width = 400,
		height = 400,
		data = new Uint8ClampedArray(width * height * 4).fill(25);
	const rectangles = [
		[10, 10, 80, 40],
		[90, 10, 40, 80],
		[10, 130, 40, 40],
		[90, 130, 40, 40],
		[10, 170, 40, 40],
		[90, 170, 40, 40],
		[10, 210, 40, 40],
		[90, 210, 40, 40],
	];
	const detections: ItemDetection[] = rectangles.map(([x, y, w, h], i) => {
		for (let yy = y; yy <= y + h; yy++)
			for (let xx = x; xx <= x + w; xx++)
				if (xx === x || xx === x + w || yy === y || yy === y + h) {
					const offset = (yy * width + xx) * 4;
					data[offset] = data[offset + 1] = data[offset + 2] = 110;
				}
		return {
			id: String(i),
			text: "label",
			match: "exact",
			confidence: 95,
			candidates: [],
			bounds: { left: (x + w - 22) / width, top: (y + 2) / height, width: 20 / width, height: 5 / height },
		};
	});
	// Artwork crossing an internal grid row is not a border: its tone varies along the line.
	for (let x = 98; x < 121; x++) {
		const offset = (50 * width + x) * 4;
		data[offset] = data[offset + 1] = data[offset + 2] = x % 2 ? 90 : 210;
	}
	const result = detectItemFootprints(data, width, height, detections);
	assert.ok(result[0].footprint);
	assert.ok(result[1].footprint);
	assert.ok(Math.abs(result[0].footprint.width - 0.2) < 0.001);
	assert.ok(Math.abs(result[1].footprint.height - 0.2) < 0.001);
	assert.deepEqual(seedReviewBoxes(result, null)[0].bounds, result[0].footprint);
	assert.ok(
		detectItemFootprints(new Uint8ClampedArray(data.length), width, height, detections).every((d) => !d.footprint),
	);
});

test("missing outer strokes can use the image frame, but missing interior borders cannot", () => {
	for (const scenario of [
		{ x: 10, y: 50, w: 80, h: 80, missing: ["left"], recovered: true },
		{ x: 330, y: 50, w: 80, h: 80, missing: ["right"], recovered: true },
		{ x: 130, y: 330, w: 40, h: 80, missing: ["bottom"], recovered: true },
		{ x: 10, y: 330, w: 80, h: 80, missing: ["left", "bottom"], recovered: true },
		{ x: 130, y: 50, w: 80, h: 80, missing: ["left"], recovered: false },
	]) {
		const width = 420,
			data = new Uint8ClampedArray(width * width * 4).fill(25);
		const support = [10, 170, 210, 250].flatMap((y) =>
			[250, 290].map((x) => ({ x, y, w: 40, h: 40, missing: [] as string[] })),
		);
		const detections: ItemDetection[] = [scenario, ...support].map(({ x, y, w, h, missing }, i) => {
			for (let yy = y; yy <= y + h; yy++)
				for (let xx = x; xx <= x + w; xx++) {
					if (
						(xx === x && !missing.includes("left")) ||
						(xx === x + w && !missing.includes("right")) ||
						yy === y ||
						(yy === y + h && !missing.includes("bottom"))
					) {
						const offset = (yy * width + xx) * 4;
						data[offset] = data[offset + 1] = data[offset + 2] = 110;
					}
				}
			return {
				id: String(i),
				text: "label",
				match: "exact",
				confidence: 95,
				candidates: [],
				bounds: { left: (x + w - 22) / width, top: (y + 2) / width, width: 20 / width, height: 5 / width },
			};
		});
		const result = detectItemFootprints(data, width, width, detections)[0];
		assert.equal(!!result.footprint, scenario.recovered, JSON.stringify(scenario));
		if (result.footprint) {
			assert.equal(result.footprintTouchesFrame, true);
			assert.ok(Math.abs(result.footprint.width - scenario.w / width) < 0.001);
			assert.ok(Math.abs(result.footprint.height - scenario.h / width) < 0.001);
		}
	}
});
