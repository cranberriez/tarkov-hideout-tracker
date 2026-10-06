import test from "node:test";
import assert from "node:assert/strict";
import { intervalDue, periodDue } from "./schedule";

const HOUR = 3_600_000;
const midnight = Date.UTC(2026, 8, 28);

test("intervals are due when never run or elapsed", () => {
	assert.equal(intervalDue(null, HOUR, 0), true);
	assert.equal(intervalDue(0, HOUR, HOUR - 1), false);
	assert.equal(intervalDue(0, HOUR, HOUR), true);
});

test("analysis periods align to UTC boundaries, not elapsed time", () => {
	assert.equal(periodDue(null, 12 * HOUR, midnight), true);
	assert.equal(periodDue(midnight + 11 * HOUR, 12 * HOUR, midnight + 12 * HOUR), true);
	assert.equal(periodDue(midnight + 12 * HOUR, 12 * HOUR, midnight + 23 * HOUR), false);
	assert.equal(periodDue(midnight + 1, 24 * HOUR, midnight + 23 * HOUR), false);
	assert.equal(periodDue(midnight + 1, 24 * HOUR, midnight + 24 * HOUR), true);
});
