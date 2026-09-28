import assert from "node:assert/strict";
import test from "node:test";
import type { ItemSummary } from "@/types/items";
import { createItemDetailNavigation, emptyItemNavigation, type ItemHistoryPort } from "./item-detail-navigation";

const itemA: ItemSummary = { id: "a", name: "A", normalizedName: "a" };
const itemB: ItemSummary = { id: "b", name: "B", normalizedName: "b" };
const itemC: ItemSummary = { id: "c", name: "C", normalizedName: "c" };
const page = "https://example.test/items?filter=needed#list";

function fixture() {
	const routerState = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { tree: "items" }, other: "preserved" };
	const entries = [
		{ href: "https://example.test/hideout", state: { __NA: true } as Record<string, unknown> },
		{ href: page, state: routerState as Record<string, unknown> },
	];
	let index = 1;
	let serial = 0;
	const traversals: number[] = [];
	const navigation = createItemDetailNavigation();
	const port: ItemHistoryPort = {
		state: () => entries[index].state,
		href: () => entries[index].href,
		push(state) {
			entries.splice(index + 1);
			entries.push({ href: entries[index].href, state });
			index += 1;
		},
		replace(state) {
			entries[index].state = state;
		},
		go(delta) {
			traversals.push(delta);
		},
		newSessionId: () => String(++serial),
	};
	navigation.connect(port, "PVP");
	function flush() {
		const delta = traversals.shift();
		assert.notEqual(delta, undefined);
		index = Math.max(0, Math.min(entries.length - 1, index + delta!));
		navigation.restore();
	}
	return {
		navigation,
		port,
		entries,
		traversals,
		routerState,
		flush,
		index: () => index,
		native(delta: number) {
			port.go(delta);
			flush();
		},
		route(href: string, preserveState = false) {
			const state = preserveState ? { ...entries[index].state } : { __NA: true };
			entries.splice(index + 1);
			entries.push({ href, state });
			index += 1;
			navigation.routeChanged();
		},
	};
}

test("opening protects the underlying page immediately, with an unchanged URL and router state", () => {
	const f = fixture();
	f.navigation.open(itemA);
	assert.equal(f.entries.length, 3);
	assert.equal(f.port.href(), page);
	assert.deepEqual(f.entries[1].state, f.routerState);
	assert.deepEqual(f.entries[2].state.__PRIVATE_NEXTJS_INTERNALS_TREE, f.routerState.__PRIVATE_NEXTJS_INTERNALS_TREE);
	assert.equal(f.entries[2].state.other, "preserved");
	assert.equal(JSON.stringify(f.port.state()).includes('"name"'), false);
	assert.deepEqual(f.navigation.getSnapshot(), { item: itemA, previousItem: null });
});

test("native Back visits previous items, then closes without leaving the page; the next Back navigates normally", () => {
	const f = fixture();
	f.navigation.open(itemA);
	f.navigation.open(itemB);
	f.navigation.open(itemC);
	f.native(-1);
	assert.deepEqual(f.navigation.getSnapshot(), { item: itemB, previousItem: itemA });
	f.native(-1);
	assert.equal(f.navigation.getSnapshot().item, itemA);
	f.native(-1);
	assert.deepEqual(f.navigation.getSnapshot(), emptyItemNavigation);
	assert.equal(f.port.href(), page);
	f.native(-1);
	assert.equal(f.port.href(), "https://example.test/hideout");
});

test("the visible Back action traverses browser history and closes at the first item", () => {
	const f = fixture();
	f.navigation.open(itemA);
	f.navigation.open(itemB);
	f.navigation.back();
	assert.equal(f.navigation.getSnapshot().item, itemB);
	f.flush();
	assert.equal(f.navigation.getSnapshot().item, itemA);
	f.navigation.back();
	f.flush();
	assert.equal(f.navigation.getSnapshot().item, null);
	assert.equal(f.index(), 1);
});

test("Close/Escape unwinds all item entries, so the next native Back leaves the underlying page normally", () => {
	const f = fixture();
	f.navigation.open(itemA);
	f.navigation.open(itemB);
	f.navigation.open(itemC);
	f.navigation.close();
	assert.deepEqual(f.traversals, [-3]);
	f.flush();
	assert.equal(f.index(), 1);
	assert.equal(f.navigation.getSnapshot().item, null);
	f.native(-1);
	assert.equal(f.index(), 0);
});

test("Forward restores session items after native Back or explicit Close", () => {
	const f = fixture();
	f.navigation.open(itemA);
	f.navigation.open(itemB);
	f.navigation.close();
	f.flush();
	f.native(1);
	assert.equal(f.navigation.getSnapshot().item, itemA);
	f.native(1);
	assert.deepEqual(f.navigation.getSnapshot(), { item: itemB, previousItem: itemA });
});

test("selecting a different item after Back truncates the forward branch", () => {
	const f = fixture();
	f.navigation.open(itemA);
	f.navigation.open(itemB);
	f.native(-1);
	f.navigation.open(itemC);
	assert.equal(f.entries.length, 4);
	assert.deepEqual(f.navigation.getSnapshot(), { item: itemC, previousItem: itemA });
	f.native(-1);
	f.native(1);
	assert.equal(f.navigation.getSnapshot().item, itemC);
});

test("repeated item clicks update its summary without creating duplicate history", () => {
	const f = fixture();
	f.navigation.open(itemA);
	const richer = { ...itemA, iconLink: "a.png" };
	f.navigation.open(richer);
	assert.equal(f.entries.length, 3);
	assert.equal(f.navigation.getSnapshot().item, richer);
});

test("a new item opened while Close is traversing waits for the base entry", () => {
	const f = fixture();
	f.navigation.open(itemA);
	f.navigation.open(itemB);
	f.navigation.close();
	f.navigation.open(itemC);
	f.flush();
	assert.equal(f.entries.length, 3);
	assert.deepEqual(f.navigation.getSnapshot(), { item: itemC, previousItem: null });
	f.native(-1);
	assert.equal(f.index(), 1);
	assert.equal(f.navigation.getSnapshot().item, null);
});

test("rapid Back clicks cannot overrun the modal's history", () => {
	const f = fixture();
	f.navigation.open(itemA);
	f.navigation.back();
	f.navigation.back();
	assert.deepEqual(f.traversals, [-1]);
	f.flush();
	assert.equal(f.port.href(), page);
});

test("route links dismiss without traversing away from the destination; native Back can restore the item", () => {
	const f = fixture();
	f.navigation.open(itemA);
	f.navigation.open(itemB);
	f.route("https://example.test/quests/quest-id");
	assert.equal(f.navigation.getSnapshot().item, null);
	assert.deepEqual(f.traversals, []);
	f.native(-1);
	assert.equal(f.port.href(), page);
	assert.equal(f.navigation.getSnapshot().item, itemB);
});

test("a route that inherits history state cannot incorrectly reopen an item on the new page", () => {
	const f = fixture();
	f.navigation.open(itemA);
	f.route("https://example.test/quests", true);
	assert.equal(f.navigation.getSnapshot().item, null);
	assert.equal("tarkovItemDialog" in (f.port.state() as object), false);
	assert.equal((f.port.state() as Record<string, unknown>).other, "preserved");
});

test("mode changes close and invalidate old summaries without changing player data", () => {
	const f = fixture();
	f.navigation.open(itemA);
	f.navigation.open(itemB);
	f.navigation.changeMode("PVE");
	assert.equal(f.navigation.getSnapshot().item, null);
	f.flush();
	f.native(1);
	assert.equal(f.navigation.getSnapshot().item, null);
	assert.equal("tarkovItemDialog" in (f.port.state() as object), false);
});

test("reloads ignore stale markers while preserving framework and unrelated state", () => {
	const f = fixture();
	f.navigation.open(itemA);
	const reloaded = createItemDetailNavigation();
	reloaded.connect(f.port, "PVP");
	reloaded.restore();
	assert.equal(reloaded.getSnapshot().item, null);
	assert.deepEqual(f.port.state(), f.routerState);
});

test("Strict Mode reconnects do not push duplicate entries", () => {
	const f = fixture();
	f.navigation.open(itemA);
	f.navigation.connect(f.port, "PVP");
	f.navigation.open(itemA);
	f.navigation.routeChanged();
	assert.equal(f.entries.length, 3);
	assert.equal(f.navigation.getSnapshot().item, itemA);
});
