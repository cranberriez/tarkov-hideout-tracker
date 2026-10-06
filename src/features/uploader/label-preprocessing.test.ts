import assert from "node:assert/strict";
import test from "node:test";
import { buildLabelTasks, prepareLabelPixels } from "./label-preprocessing";

test("neutral mask excludes tinted outlines while retaining dim gray label pixels", () => {
	const pixels = new Uint8ClampedArray([120, 120, 120, 255, 120, 200, 120, 255, 50, 50, 50, 255]);
	const [all, neutral] = prepareLabelPixels(pixels);
	assert.deepEqual([...all], [0, 0, 255]);
	assert.deepEqual([...neutral], [0, 255, 255]);
	assert.equal(pixels[0], 135);
	assert.equal(pixels[8], 205);
});

test("row crops exclude artwork that touches the label from below", () => {
	const width = 100;
	const height = 100;
	const mask = new Uint8Array(width * height).fill(255);
	// A label and a narrow stroke from its icon form one over-tall region in a
	// tolerance-sized band. A text-sized band retains the label without the icon.
	for (let y = 20; y < 30; y++) for (let x = 40; x < 52; x++) mask[y * width + x] = 0;
	for (let y = 30; y < 38; y++) mask[y * width + 45] = 0;
	const before = mask.slice();
	const tasks = buildLabelTasks([mask], width, height, { firstTop: 20, pitch: 60, textHeight: 10, tolerance: 8 });
	assert.ok(tasks.some((task) => task.top + task.region.top === 20 && task.region.height === 11));
	assert.deepEqual(mask, before, "cleaning row masks must not mutate the full image");
});

test("crop bounds are clipped to the image at both edges", () => {
	const width = 50;
	const height = 30;
	const mask = new Uint8Array(width * height).fill(255);
	for (const top of [0, 25])
		for (let y = top; y < Math.min(height, top + 10); y++) for (let x = 10; x < 18; x++) mask[y * width + x] = 0;
	const tasks = buildLabelTasks([mask], width, height, { firstTop: 0, pitch: 25, textHeight: 10, tolerance: 5 });
	assert.ok(tasks.some((task) => task.top + task.region.top === 0));
	assert.ok(tasks.some((task) => task.top + task.region.top === 25));
	for (const task of tasks) {
		assert.ok(task.top >= 0);
		assert.ok(task.top + task.region.top + task.region.height <= height);
	}
});

test("identical contrast crops are read once while different pixel evidence is retained", () => {
	const width = 100,
		height = 50;
	const mask = new Uint8Array(width * height).fill(255);
	for (let y = 10; y < 20; y++) for (let x = 20; x < 32; x++) mask[y * width + x] = 0;
	const changed = mask.slice();
	changed[15 * width + 25] = 255;
	const grid = { firstTop: 10, pitch: 40, textHeight: 10, tolerance: 1 };
	const one = buildLabelTasks([mask], width, height, grid);
	const duplicates = buildLabelTasks([mask, mask.slice(), mask.slice(), mask.slice()], width, height, grid);
	assert.equal(duplicates.length, one.length);
	assert.ok(buildLabelTasks([mask, changed], width, height, grid).length > one.length);
});
