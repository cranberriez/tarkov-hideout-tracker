import assert from "node:assert/strict";
import test from "node:test";
import { decodeSearchManifest } from "../../lib/search/manifest";
import { buildPaletteIndex, parsePaletteInput, searchPalette } from "./search-model";

const manifest = decodeSearchManifest(
	{
		v: 1,
		mode: "regular",
		releaseId: "r1",
		items: [
			{ id: "same", n: "Graphics card", nn: "graphics-card", sn: "GPU" },
			{ id: "gun", n: "Magpul grip", nn: "magpul-grip" },
		],
		quests: [{ id: "same", n: "Farming - Part 4", nn: "farming-part-4", ti: "mechanic" }],
		traders: { mechanic: { n: "Mechanic" } },
	},
	"regular",
	"r1",
);

test("combined catalog ranks exact abbreviations first and preserves entity kinds", () => {
	const index = buildPaletteIndex(manifest);
	assert.deepEqual(
		searchPalette(index, "gpu").map((result) => result.id),
		["same", "gun"],
	);
	const quest = searchPalette(index, "FARMING 4")[0];
	assert.equal(quest.kind, "quest");
	assert.equal(quest.id, "same");
	assert.equal(quest.kind === "quest" && quest.trader, "Mechanic");
	assert.equal(quest.iconLink, undefined);
	assert.equal(index.filter((result) => result.id === "same").length, 2);
});

test("empty, punctuation-only and unmatched searches have no results; matching is local and deterministic", () => {
	const index = buildPaletteIndex(manifest);
	for (const query of ["", "  ", "---", "unmatched"]) assert.deepEqual(searchPalette(index, query), []);
	assert.equal(searchPalette(index, "card graphics")[0].name, "Graphics card");
	assert.deepEqual(buildPaletteIndex(manifest), index);
});

test("prefixes consume only one leading filter and preserve the remaining search", () => {
	assert.deepEqual(parsePaletteInput("i:GPU"), { kind: "item", query: "GPU" });
	assert.deepEqual(parsePaletteInput(" Q: farming 4"), { kind: "quest", query: "farming 4" });
	assert.deepEqual(parsePaletteInput("i:"), { kind: "item", query: "" });
	assert.deepEqual(parsePaletteInput("q: farming", "item"), { kind: "item", query: "q: farming" });
	assert.deepEqual(parsePaletteInput("find i:GPU"), { kind: null, query: "find i:GPU" });
	assert.deepEqual(parsePaletteInput("i:q:farming"), { kind: "item", query: "q:farming" });
});

test("a chip restricts matches and an empty scoped query browses only that kind", () => {
	const index = buildPaletteIndex(manifest);
	assert.equal(searchPalette(index, "farming", "item").length, 0);
	assert.equal(searchPalette(index, "GPU", "quest").length, 0);
	assert.deepEqual(searchPalette(index, "", "quest").map((entry) => entry.name), ["Farming - Part 4"]);
	assert.ok(searchPalette(index, "a", "item").every((entry) => entry.kind === "item"));
	assert.equal(searchPalette(index, "a").length, 3);
});
