import assert from "node:assert/strict";
import test from "node:test";
import {
	buildExport,
	importWrites,
	reviewImport,
	type TransferContext,
	type TransferSources,
} from "./battle-pass-transfer-model";

const context: TransferContext = {
	seasonId: "season-1",
	seasonName: (id) => (id === "season-1" ? "KORD" : "Test"),
	tiles: [
		{ id: "a", displayName: "A" },
		{ id: "b", displayName: "B" },
	],
	documents: [{ key: "financial", name: "Financial documents" }],
	profiles: [{ key: "PVP", label: "PVP", inventory: { financial: 3 } }],
};
const sources: TransferSources = {
	progress: JSON.stringify({ version: 1, completed: ["a", "legacy"], goals: ["b"], classified: 2, extra: true }),
	costs: null,
	route: null,
	funding: JSON.stringify({ version: 1, startingTarCoins: 50 }),
	preferences: JSON.stringify({ optimizerEnabled: true, listMode: true }),
};

test("an export of the current saves reviews as no changes", () => {
	const review = reviewImport(JSON.stringify(buildExport(sources, context)), sources, context);
	assert.ok(review.ok);
	assert.equal(review.sections.flatMap((section) => section.rows).length, 0);
});

test("files for another season or of another kind are rejected", () => {
	const file = buildExport(sources, { ...context, seasonId: "season-2" });
	assert.equal(reviewImport(JSON.stringify(file), sources, context).ok, false);
	assert.equal(reviewImport("{}", sources, context).ok, false);
	assert.equal(reviewImport("not json", sources, context).ok, false);
});

test("chosen rows merge into the latest saves and keep unknown fields and rewards", () => {
	const file = buildExport(sources, context);
	file.progress = { completed: ["b"], goals: ["a"], classified: 5, avoidedDocuments: [] };
	file.documents.PVP.financial = 9;
	file.documents["season-1"] = { financial: 1 };
	const review = reviewImport(JSON.stringify(file), sources, context);
	assert.ok(review.ok);
	assert.match(review.warnings.join(" "), /isn't activated/);
	const rows = review.sections.flatMap((section) => section.rows);
	// Keep the existing classified balance by leaving its row unchecked.
	const { writes, documents } = importWrites(
		rows.filter((row) => row.id !== "progress.classified").map((row) => row.change),
	);
	assert.deepEqual(documents, [{ type: "document", profile: "PVP", key: "financial", value: 9 }]);
	const progress = JSON.parse(writes.get("progress")!(sources.progress));
	assert.deepEqual(progress.completed, ["b", "legacy"]);
	assert.deepEqual(progress.goals, ["a"]);
	assert.equal(progress.classified, 2);
	assert.equal(progress.extra, true);
});
