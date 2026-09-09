import assert from "node:assert/strict";
import test from "node:test";
import { decodeSearchManifest } from "../../lib/search/manifest";
import { buildPaletteIndex, searchPalette } from "./search-model";

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
