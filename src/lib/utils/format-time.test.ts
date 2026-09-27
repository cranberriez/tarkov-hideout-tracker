import assert from "node:assert/strict";
import test from "node:test";
import { formatDuration } from "./format-time";

test("formatDuration formats whole minutes and hours", () => {
	assert.equal(formatDuration(0), "0m");
	assert.equal(formatDuration(600), "10m");
	assert.equal(formatDuration(3_600), "1h 0m");
	assert.equal(formatDuration(5_400), "1h 30m");
});

test("formatDuration carries rounded minutes into the hour", () => {
	assert.equal(formatDuration(3_590), "1h 0m");
	assert.equal(formatDuration(7_170), "2h 0m");
});
