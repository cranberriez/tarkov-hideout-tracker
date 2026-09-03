import assert from "node:assert/strict";
import test from "node:test";
import {
    emptyItemNavigation,
    popItemNavigation,
    pushItemNavigation,
    reconcileItemNavigation,
} from "./item-detail-navigation";

const itemA = { id: "a", iconLink: "a.png" };
const itemB = { id: "b", iconLink: "b.png" };
const itemC = { id: "c", iconLink: "c.png" };

test("starts a navigation session with the item that opened the modal", () => {
    assert.deepEqual(reconcileItemNavigation(emptyItemNavigation, itemA, true), {
        sourceItemId: "a",
        entries: [itemA],
    });
});

test("keeps internal item selections in order and returns to the previous item", () => {
    const opened = reconcileItemNavigation(emptyItemNavigation, itemA, true);
    const navigated = pushItemNavigation(pushItemNavigation(opened, itemB), itemC);

    assert.deepEqual(popItemNavigation(navigated).entries, [itemA, itemB]);
});

test("adds a newly opened source item without clearing the active session", () => {
    const opened = reconcileItemNavigation(emptyItemNavigation, itemA, true);
    const navigated = pushItemNavigation(opened, itemB);
    const reopened = reconcileItemNavigation(navigated, itemC, true);

    assert.deepEqual(reopened.entries, [itemA, itemB, itemC]);
});

test("does not duplicate an item when the source catches up with internal navigation", () => {
    const opened = reconcileItemNavigation(emptyItemNavigation, itemA, true);
    const navigated = pushItemNavigation(opened, itemB);
    const reconciled = reconcileItemNavigation(navigated, itemB, true);

    assert.deepEqual(reconciled.entries, [itemA, itemB]);
});

test("clears the navigation session when the modal closes", () => {
    const opened = reconcileItemNavigation(emptyItemNavigation, itemA, true);
    assert.deepEqual(reconcileItemNavigation(opened, itemA, false), emptyItemNavigation);
});
