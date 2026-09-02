import assert from "node:assert/strict";
import test from "node:test";
import type { BarterRecord, CraftRecord } from "@/types";
import { buildItemAcquisitionTree } from "../../lib/price-calculation/acquisition-tree";

test("buildItemAcquisitionTree returns only the reachable cycle-safe subgraph", () => {
    const barter: BarterRecord = {
        id: "barter-a", offeredItemId: "A", offeredCount: 1, traderId: "t",
        minTraderLevel: 1, requiredItems: [{ itemId: "B", count: 1 }],
    };
    const craft: CraftRecord = {
        id: "craft-b", productItemId: "B", productCount: 1, stationId: "s", level: 1,
        duration: 1, requiredItems: [{ itemId: "A", count: 1 }],
        requiredQuestItems: [], gameEditions: [],
    };
    const unrelated: CraftRecord = {
        ...craft, id: "craft-z", productItemId: "Z", requiredItems: [],
    };

    const tree = buildItemAcquisitionTree(
        "A",
        { A: [barter] },
        { B: [craft], Z: [unrelated] },
    );

    assert.deepEqual(tree.itemIds.sort(), ["A", "B"]);
    assert.deepEqual(tree.barters.map((entry) => entry.id), ["barter-a"]);
    assert.deepEqual(tree.crafts.map((entry) => entry.id), ["craft-b"]);
    assert.equal(tree.truncated, false);
});
