import assert from "node:assert/strict";
import test from "node:test";
import type { ItemSummary } from "../../types/items";
import {
	buildLabelIndex,
	inferLabelGrid,
	mergeLabelPasses,
	normalizeLabel,
	recognizeLabels,
	summarizeDetections,
	type LabelWord,
} from "./recognition-model";

const gpu: ItemSummary = { id: "gpu", name: "Graphics card", normalizedName: "graphics-card", shortName: "GPU" };

test("moderate two-character labels remain reviewable rather than disappearing", () => {
	const ec = { id: "ec", name: "Electronic components", normalizedName: "electronic-components", shortName: "EC" };
	const index = buildLabelIndex([ec]);
	const read = (confidence: number) =>
		recognizeLabels(
			[{ words: [{ text: "EC", confidence, bbox: { x0: 975, y0: 10, x1: 995, y1: 22 } }] }],
			index,
			1000,
			1000,
			0,
		);
	const uncertain = read(65);
	assert.equal(uncertain[0].match, "uncertain");
	assert.equal(uncertain[0].candidates[0].id, "ec");
	assert.deepEqual(summarizeDetections(uncertain), []);
	assert.equal(read(90)[0].match, "exact");
	assert.equal(read(10)[0].match, "unmatched");
});
const intel: ItemSummary = {
	id: "intel",
	name: "Intelligence folder",
	normalizedName: "intelligence-folder",
	shortName: "Intelligence",
};
const loot: ItemSummary = {
	id: "loot",
	name: "Loot Lord plushie",
	normalizedName: "loot-lord-plushie",
	shortName: "Loot Lord",
};
const word = (text: string, x0 = 10, confidence = 90, y0 = 10): LabelWord => ({
	text,
	confidence,
	bbox: { x0, y0, x1: x0 + text.length * 6, y1: y0 + 10 },
});

test("dense rows preserve repeated items and join multiword labels without double counting", () => {
	const labels = recognizeLabels(
		[
			{ words: [word("GPU"), word("GPU", 100), word("Loot", 200), word("Lord", 228)] },
			{ words: [word("Intelligence", 10, 90, 80)] },
		],
		buildLabelIndex([gpu, intel, loot]),
		1000,
		1000,
	);
	assert.deepEqual(
		labels.map((entry) => entry.candidates[0]?.id),
		["gpu", "gpu", "loot", "intel"],
	);
	assert.deepEqual(
		summarizeDetections(labels).map((group) => [group.item.id, group.occurrences]),
		[
			["gpu", 2],
			["loot", 1],
			["intel", 1],
		],
	);
	assert.deepEqual(labels[2].bounds, { left: 0.2, top: 0.01, width: 0.052, height: 0.01 });
});

test("duplicate short names stay ambiguous and do not become unique item counts", () => {
	const diary = (id: string): ItemSummary => ({
		id,
		name: `${id} diary`,
		normalizedName: `${id}-diary`,
		shortName: "Diary",
	});
	const result = recognizeLabels(
		[{ words: [word("Diary")] }],
		buildLabelIndex([diary("thin"), diary("regular")]),
		1000,
		1000,
	);
	assert.equal(result[0].match, "ambiguous");
	assert.equal(result[0].candidates.length, 2);
	assert.deepEqual(summarizeDetections(result), []);
});

test("OCR typos and numeric stack counts cannot become item guesses", () => {
	const result = recognizeLabels(
		[{ words: [word("Intelligenee"), word("GPI", 150), word("60", 250)] }],
		buildLabelIndex([gpu, intel]),
		1000,
		1000,
	);
	assert.equal(result[0].match, "unmatched");
	assert.deepEqual(result[0].candidates, []);
	assert.equal(result[1].match, "unmatched");
	assert.equal(result.length, 2);
	assert.deepEqual(summarizeDetections(result), []);
});

test("only short names match; full names and close spellings are not aliases", () => {
	const mask: ItemSummary = {
		id: "mask",
		name: "Work Peak training mask",
		normalizedName: "mask",
		shortName: "Sharky",
	};
	const diary: ItemSummary = { id: "diary", name: "Slim diary", normalizedName: "diary", shortName: "SDiary" };
	const index = buildLabelIndex([gpu, mask, diary]);
	assert.deepEqual(
		index.get("gpu")?.map((entry) => entry.id),
		["gpu"],
	);
	assert.equal(index.has("graphicscard"), false);
	assert.equal(recognizeLabels([{ words: [word("Sdiary")] }], index, 1000, 1000)[0].candidates[0].id, "diary");
	assert.equal(recognizeLabels([{ words: [word("Shiary")] }], index, 1000, 1000)[0].match, "unmatched");
	assert.equal(buildLabelIndex([{ ...gpu, shortName: undefined }]).size, 0);
});

test("aliases and candidates remain scoped to the supplied catalog", () => {
	const lines = [{ words: [word("GPU")] }];
	assert.equal(recognizeLabels(lines, buildLabelIndex([gpu]), 100, 100)[0].match, "exact");
	assert.equal(recognizeLabels(lines, buildLabelIndex([intel]), 100, 100)[0].match, "unmatched");
});

test("low confidence, invalid bounds, and empty dimensions cannot create recognized items", () => {
	const index = buildLabelIndex([gpu]);
	assert.deepEqual(recognizeLabels([{ words: [word("GPU", 10, 20)] }], index, 100, 100), []);
	assert.deepEqual(
		recognizeLabels([{ words: [{ ...word("GPU"), bbox: { x0: NaN, x1: 20, y0: 0, y1: 10 } }] }], index, 100, 100),
		[],
	);
	assert.deepEqual(recognizeLabels([{ words: [word("GPU")] }], index, 0, 100), []);
	const clipped = recognizeLabels([{ words: [word("GPU", -5)] }], index, 20, 15)[0];
	assert.deepEqual(clipped.bounds, { left: 0, top: 10 / 15, width: 13 / 20, height: 5 / 15 });
});

test("separate item cells and rejected words cannot join into a multiword match", () => {
	const index = buildLabelIndex([loot]);
	for (const words of [
		[word("Loot"), word("Lord", 100)],
		[word("Loot"), word("bad", 38, 10), word("Lord", 50)],
	]) {
		assert.equal(
			recognizeLabels([{ words }], index, 1000, 1000).some((entry) => entry.match === "exact"),
			false,
		);
	}
});

test("regular label rows infer the largest supported pitch and exclude unrelated UI", () => {
	const lines = [17, 44, 113, 182, 320, 458].map((top) => ({
		words: [word("GPU", 10, 90, top), word("GPU", 100, 90, top)],
	}));
	const detections = recognizeLabels(lines, buildLabelIndex([gpu]), 1000, 1000);
	const grid = inferLabelGrid(detections, 1000);
	assert.ok(grid);
	assert.ok(Math.abs(grid.pitch - 69) < 0.001);
	assert.ok(Math.abs(grid.firstTop - 44) < 0.001);
	assert.equal(grid.textHeight, 10);
	assert.equal(inferLabelGrid(detections.slice(0, 4), 1000), null);
});

test("scattered label rows do not imply a grid", () => {
	const lines = [20, 100, 243, 431, 770].map((top) => ({
		words: [word("GPU", 10, 90, top), word("GPU", 100, 90, top)],
	}));
	assert.equal(inferLabelGrid(recognizeLabels(lines, buildLabelIndex([gpu]), 1000, 1000), 1000), null);
});

test("rounded OCR positions fit a stable pitch without drifting into artwork down the stash", () => {
	const positions = Array.from({ length: 13 }, (_, row) => Math.round(44 + row * 68.7 + [0, 1, -1][row % 3]));
	const lines = positions.map((top) => ({ words: [word("GPU", 10, 90, top), word("GPU", 100, 90, top)] }));
	const grid = inferLabelGrid(recognizeLabels(lines, buildLabelIndex([gpu]), 1000, 1000), 1000);
	assert.ok(grid);
	assert.ok(Math.abs(grid.pitch - 68.7) < 0.12);
	assert.ok(Math.abs(grid.firstTop + 12 * grid.pitch - (44 + 12 * 68.7)) < 1);
});

test("an exact short name read with moderate confidence is retained", () => {
	const result = recognizeLabels([{ words: [word("GPU", 10, 42)] }], buildLabelIndex([gpu]), 100, 100);
	assert.equal(result[0].match, "exact");
});

test("isolated low-confidence short names are review candidates, not counted items", () => {
	const index = buildLabelIndex([gpu]);
	const result = recognizeLabels([{ words: [word("GPU", 10, 0, 44)] }], index, 1000, 1000, 0);
	assert.equal(result[0].match, "uncertain");
	assert.equal(result[0].candidates[0].id, "gpu");
	assert.deepEqual(summarizeDetections(result), []);
	const stronger = recognizeLabels([{ words: [word("GPU", 10, 80, 44)] }], index, 1000, 1000);
	const grid = { pitch: 69, firstTop: 44, textHeight: 10, tolerance: 4.5 };
	for (const [a, b] of [
		[result, stronger],
		[stronger, result],
	]) {
		const merged = mergeLabelPasses(a, b, grid, 1000);
		assert.equal(merged.length, 1);
		assert.equal(merged[0].match, "exact");
		assert.equal(summarizeDetections(merged)[0].occurrences, 1);
	}
});

test("separate border punctuation cannot drag an exact label out of its grid row", () => {
	const lines = [{ words: [word("__", 0, 0, 38), word("GPU", 15, 90, 44), word("|", 35, 0, 40)] }];
	const result = recognizeLabels(lines, buildLabelIndex([gpu]), 1000, 1000, 0);
	assert.equal(result.length, 1);
	assert.equal(result[0].text, "GPU");
	assert.equal(result[0].confidence, 90);
	assert.equal(result[0].bounds.top, 0.044);
	assert.equal(result[0].bounds.width, 0.018);
	assert.equal(result[0].match, "exact");
});

test("complementary passes count each label once and exclude container titles", () => {
	const index = buildLabelIndex([gpu, intel]);
	const first = recognizeLabels(
		[{ words: [word("GPU", 10, 85, 44), word("GPU", 100, 85, 44)] }, { words: [word("GPU", 10, 90, 17)] }],
		index,
		1000,
		1000,
	);
	const second = recognizeLabels(
		[{ words: [word("GPU", 11, 95, 44), word("Intelligence", 200, 90, 113)] }],
		index,
		1000,
		1000,
	);
	const merged = mergeLabelPasses(first, second, { pitch: 69, firstTop: 44, textHeight: 10, tolerance: 4.5 }, 1000);
	assert.deepEqual(
		summarizeDetections(merged).map((group) => [group.item.id, group.occurrences]),
		[
			["gpu", 2],
			["intel", 1],
		],
	);
	assert.equal(merged[0].confidence, 95);
	assert.equal(new Set(merged.map((entry) => entry.id)).size, merged.length);
});

test("contradictory exact identities at the same position remain ambiguous", () => {
	const index = buildLabelIndex([gpu, intel]);
	const first = recognizeLabels([{ words: [word("GPU", 10, 90, 44)] }], index, 1000, 1000);
	const second = recognizeLabels([{ words: [word("Intelligence", 10, 90, 44)] }], index, 1000, 1000);
	const merged = mergeLabelPasses(first, second, { pitch: 69, firstTop: 44, textHeight: 10, tolerance: 4.5 }, 1000);
	assert.equal(merged[0].match, "ambiguous");
	assert.deepEqual(
		merged[0].candidates.map((item) => item.id),
		["gpu", "intel"],
	);
	assert.deepEqual(summarizeDetections(merged), []);
});

test("accented and Cyrillic look-alike short names match plain OCR reads", () => {
	assert.equal(normalizeLabel("Pâté"), "pate");
	assert.equal(normalizeLabel("ТТ 855A1"), normalizeLabel("TT 855A1"));
});
