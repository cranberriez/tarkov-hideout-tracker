import assert from "node:assert/strict";
import test from "node:test";
import type { ItemSummary } from "../../types/items";
import type { ItemDetection } from "./recognition-model";
import { finishReview, seedReviewBoxes, suggestReviewGrid, summarizeReview, type ReviewBox } from "./review-model";

const gpu: ItemSummary = { id: "gpu", name: "Graphics card", normalizedName: "graphics-card", shortName: "GPU" };
const box = (id: string, itemId: string | null, quantity = 1): ReviewBox => ({
	id,
	itemId,
	quantity,
	bounds: { left: 0.1, top: 0.1, width: 0.1, height: 0.1 },
	candidates: [],
	text: "",
	confirmed: false,
	foundInRaid: "unknown",
	firConfirmed: false,
});
const detection = (id: string, match: ItemDetection["match"], left = 0.1, top = 0.1): ItemDetection => ({
	id,
	match,
	text: "GPU",
	confidence: 90,
	bounds: { left, top, width: 0.03, height: 0.01 },
	candidates: match === "unmatched" ? [] : [gpu],
});

test("unknown and ambiguous detections become editable unassigned boxes", () => {
	const other = { ...gpu, id: "other", name: "Other item" };
	const boxes = seedReviewBoxes(
		[
			detection("a", "exact"),
			{ ...detection("b", "ambiguous", 0.3), candidates: [gpu, other] },
			detection("c", "unmatched", 0.5),
		],
		null,
	);
	assert.equal(boxes.length, 3);
	assert.deepEqual(
		boxes.map((b) => b.itemId),
		["gpu", null, null],
	);
	assert.ok(boxes.every((b) => b.bounds.height > 0.01));
	assert.equal(finishReview(boxes, [gpu]), null);
});
test("label fragments in a known box do not create a second item", () => {
	const boxes = seedReviewBoxes([detection("fragment", "unmatched"), detection("item", "exact")], null);
	assert.equal(boxes.length, 1);
	assert.equal(boxes[0].id, "item");
});
test("separate repeated items remain separate and edited quantities aggregate by stable ID", () => {
	const boxes = seedReviewBoxes([detection("a", "exact"), detection("b", "exact", 0.3)], null);
	boxes[1] = { ...boxes[1], quantity: 4, confirmed: true };
	assert.deepEqual(finishReview(boxes, [gpu]), [{ itemId: "gpu", quantity: 5, foundInRaid: "unknown" }]);
	assert.equal(summarizeReview(boxes, [gpu]).unresolved, 0);
});
test("missing catalog identities, invalid counts, and empty reviews cannot finish", () => {
	for (const boxes of [
		[],
		[box("a", null)],
		[box("a", "missing")],
		[box("a", "gpu", 0)],
		[box("a", "gpu", NaN)],
		[box("a", "gpu", 1.5)],
	])
		assert.equal(finishReview(boxes, [gpu]), null);
	assert.equal(finishReview([box("a", "gpu")], []), null);
});
test("final list is a detached snapshot of reviewed IDs and quantities", () => {
	const boxes = [box("a", "gpu", 3)];
	const result = finishReview(boxes, [gpu]);
	boxes[0].quantity = 9;
	assert.deepEqual(result, [{ itemId: "gpu", quantity: 3, foundInRaid: "unknown" }]);
});

test("conflicting candidates snapped to one box require a player choice", () => {
	const other = { ...gpu, id: "other", name: "Other item" };
	const second = { ...detection("b", "exact"), candidates: [other] };
	const boxes = seedReviewBoxes([detection("a", "exact"), second], null);
	assert.equal(boxes.length, 1);
	assert.equal(boxes[0].itemId, null);
	assert.deepEqual(
		boxes[0].candidates.map((item) => item.id),
		["gpu", "other"],
	);
});

test("aggregate quantities must remain safe integers", () => {
	assert.equal(finishReview([box("a", "gpu", Number.MAX_SAFE_INTEGER), box("b", "gpu", 1)], [gpu]), null);
});
test("review holds FIR, non-FIR, and unknown quantities separately without inventing a status", () => {
	const boxes = [
		{ ...box("a", "gpu", 2), foundInRaid: "yes" as const },
		{ ...box("b", "gpu", 3), foundInRaid: "no" as const, firConfirmed: true },
		box("c", "gpu", 4),
		{ ...box("d", "gpu", 1), foundInRaid: "yes" as const },
	];
	assert.deepEqual(finishReview(boxes, [gpu]), [
		{ itemId: "gpu", quantity: 3, foundInRaid: "yes" },
		{ itemId: "gpu", quantity: 3, foundInRaid: "no" },
		{ itemId: "gpu", quantity: 4, foundInRaid: "unknown" },
	]);
	assert.equal(seedReviewBoxes([{ ...detection("a", "exact"), foundInRaid: "yes" }], null)[0].foundInRaid, "yes");
});
test("suggested cells require repeated row evidence and scale with image aspect ratio", () => {
	assert.equal(suggestReviewGrid([detection("a", "exact")], 1000, 1000), null);
	const detections = [0.05, 0.15, 0.25, 0.35].flatMap((top, row) => [
		detection(`${row}:1`, "exact", 0.015, top),
		detection(`${row}:2`, "exact", 0.065, top),
	]);
	const grid = suggestReviewGrid(detections, 2000, 1000);
	assert.ok(grid);
	assert.ok(Math.abs(grid.cellWidth - 0.05) < 1e-8);
	assert.ok(Math.abs(grid.cellHeight - 0.1) < 1e-8);
});

test("manual additions combine with scanned items without inventing screenshot bounds", () => {
	const result = summarizeReview(
		[
			box("scan", "gpu", 2),
			{ itemId: "gpu", quantity: 3, foundInRaid: "yes" },
			{ itemId: "gpu", quantity: 4, foundInRaid: "yes" },
		],
		[gpu],
	);
	assert.equal(result.unresolved, 0);
	assert.deepEqual(
		result.totals.map(({ quantity, foundInRaid }) => ({ quantity, foundInRaid })),
		[
			{ quantity: 2, foundInRaid: "unknown" },
			{ quantity: 7, foundInRaid: "yes" },
		],
	);
	assert.equal(summarizeReview([{ itemId: "missing", quantity: 1, foundInRaid: "no" }], [gpu]).unresolved, 1);
	assert.equal(summarizeReview([{ itemId: "gpu", quantity: 0, foundInRaid: "no" }], [gpu]).unresolved, 1);
});
