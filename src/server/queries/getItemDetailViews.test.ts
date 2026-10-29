import assert from "node:assert/strict";
import test from "node:test";
import type { ItemAcquisitionTreeData, ItemRelationsPayload, ItemUsageData } from "@/types/contracts";
import { getItemDetailViews } from "./getItemDetailViews";

const relations = { item: null, errors: {} } as unknown as ItemRelationsPayload;
const usage = { barters: [], crafts: [] } as unknown as ItemUsageData;

test("initial item rendering reads relations without starting deferred recipe readers", async () => {
	const views = await getItemDetailViews(
		"pvp-season",
		"item-a",
		{
			relations: async (mode, itemId) => {
				assert.equal(mode, "pvp-season");
				assert.equal(itemId, "item-a");
				return relations;
			},
			usage: async () => {
				assert.fail("usage must remain deferred");
			},
			tree: async () => {
				assert.fail("acquisition must remain deferred");
			},
		},
		["relations"],
	);
	assert.deepEqual(views, { relations, usage: null, tree: null });
});

test("item detail views read all three views for one item and mode", async () => {
	const calls: string[] = [];
	const views = await getItemDetailViews("pve", "item-a", {
		relations: async (mode, itemId) => {
			calls.push(`relations:${mode}:${itemId}`);
			return relations;
		},
		usage: async (mode, itemId) => {
			calls.push(`usage:${mode}:${itemId}`);
			return usage;
		},
		tree: async (mode, itemId) => {
			calls.push(`tree:${mode}:${itemId}`);
			return { errors: {} } as unknown as ItemAcquisitionTreeData;
		},
	});
	assert.deepEqual(calls.sort(), ["relations:pve:item-a", "tree:pve:item-a", "usage:pve:item-a"]);
	assert.equal(views.relations, relations);
	assert.equal(views.usage, usage);
});

test("a failed view is null without discarding the others", async () => {
	const views = await getItemDetailViews("regular", "item-a", {
		relations: async () => relations,
		usage: async () => {
			throw new Error("offline");
		},
		tree: async () => {
			throw new Error("offline");
		},
	});
	assert.deepEqual(views, { relations, usage: null, tree: null });
});
