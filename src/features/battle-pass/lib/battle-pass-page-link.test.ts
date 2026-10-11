import assert from "node:assert/strict";
import test from "node:test";
import { battlePassPageHref, battlePassSpreadStart, parseBattlePassPage } from "./battle-pass-page-link";

test("page links accept only an existing one-based integer page", () => {
	assert.equal(parseBattlePassPage("12", 12), 12);
	for (const value of [undefined, ["2", "3"], "0", "13", "-1", "1.5", "02", "2x", ""]) {
		assert.equal(parseBattlePassPage(value, 12), undefined);
	}
	assert.equal(battlePassPageHref(7), "/battle-pass?page=7#pass-page-7");
});

test("linked pages remain in the visible spread including the final mobile and desktop page", () => {
	for (const spread of [1, 2]) {
		for (let page = 1; page <= 12; page++) {
			const first = battlePassSpreadStart(page, 12, spread);
			assert.ok(first >= 0 && first <= 12 - spread);
			assert.ok(page - 1 >= first && page - 1 < first + spread);
		}
	}
	assert.equal(battlePassSpreadStart(12, 12, 2), 10);
	assert.equal(battlePassSpreadStart(12, 12, 1), 11);
});
