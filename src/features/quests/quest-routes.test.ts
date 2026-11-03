import assert from "node:assert/strict";
import test from "node:test";
import { modeHref, splitModePath, switchModeHref } from "../../lib/entity-routes";
import { getLegacyQuestHashId, isQuestWorkspaceUrl, questHref, selectedQuestIdFromPath } from "./quest-routes";

test("quest hrefs are mode-scoped, encode IDs and keep the development fixture query", () => {
	assert.equal(questHref("PVP", "5936d90786f7742b1420ba5b"), "/pvp/quests/5936d90786f7742b1420ba5b");
	assert.equal(questHref("KORD", "a/b"), "/kord/quests/a%2Fb");
	assert.equal(questHref("PVE", "dev-test-quest", "dev-test"), "/pve/quests/dev-test-quest?q=dev-test");
});

test("only mode-scoped paths get a mode prefix, and switching keeps the path and query", () => {
	assert.equal(modeHref("PVE", "/items?x=1"), "/pve/items?x=1");
	assert.equal(modeHref("PVE", "/settings"), "/settings");
	assert.deepEqual(splitModePath("/kord/hideout/stations/a"), { mode: "KORD", path: "/hideout/stations/a" });
	assert.deepEqual(splitModePath("/settings"), { mode: null, path: "/settings" });
	assert.equal(switchModeHref("/pvp/maps/customs", "?preset=documents", "PVE"), "/pve/maps/customs?preset=documents");
});

test("workspace URLs select quests per mode", () => {
	assert.equal(selectedQuestIdFromPath("/pve/quests/a%2Fb"), "a/b");
	assert.equal(selectedQuestIdFromPath("/pve/quests"), null);
	assert.equal(selectedQuestIdFromPath("/pve/items/abc"), null);
	assert.equal(isQuestWorkspaceUrl(new URL("https://x.test/pve/quests/abc?q=1"), "PVE"), true);
	assert.equal(isQuestWorkspaceUrl(new URL("https://x.test/pvp/quests/abc"), "PVE"), false);
	assert.equal(isQuestWorkspaceUrl(new URL("https://x.test/pve/quests/abc/extra"), "PVE"), false);
});

test("legacy quest fragments resolve to their quest ID", () => {
	assert.equal(getLegacyQuestHashId("#quest-abc"), "abc");
	assert.equal(getLegacyQuestHashId("#objectives"), null);
	assert.equal(getLegacyQuestHashId(""), null);
});
