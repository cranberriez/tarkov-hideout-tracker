import assert from "node:assert/strict";
import test from "node:test";
import { useKappaStore } from "./useKappaStore";

function resetStore() {
    useKappaStore.setState({ completedItemsByMode: {}, viewMode: "all" });
}

test("tracks completed Kappa items separately by game mode", () => {
    resetStore();

    useKappaStore.getState().toggleCompletedItem("PVP", "item-a");
    useKappaStore.getState().toggleCompletedItem("PVE", "item-b");

    assert.equal(useKappaStore.getState().completedItemsByMode.PVP?.["item-a"], true);
    assert.equal(useKappaStore.getState().completedItemsByMode.PVP?.["item-b"], undefined);
    assert.equal(useKappaStore.getState().completedItemsByMode.PVE?.["item-b"], true);

    useKappaStore.getState().toggleCompletedItem("PVP", "item-a");
    assert.equal(useKappaStore.getState().completedItemsByMode.PVP?.["item-a"], undefined);
});

test("stores the selected view and supports scoped resets", () => {
    resetStore();
    useKappaStore.getState().toggleCompletedItem("KORD", "item-a");
    useKappaStore.getState().setViewMode("need");

    useKappaStore.getState().resetCompletedItems();
    assert.deepEqual(useKappaStore.getState().completedItemsByMode, {});
    assert.equal(useKappaStore.getState().viewMode, "need");

    useKappaStore.getState().resetAll();
    assert.equal(useKappaStore.getState().viewMode, "all");
});
