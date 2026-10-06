import assert from "node:assert/strict";
import test from "node:test";
import { parseReleaseTimeline, resolveItemRelease } from "./game-releases";

const first = { patch: "1.1.5.0", releasedAt: "2026-09-01T00:00:00Z" };
const second = { patch: "1.2.0.0", releasedAt: "2026-10-01T00:00:00Z", modes: ["pvp-season"] };

test("configured releases distinguish builds and the beta/1.0 boundary", () => {
	for (const mode of ["regular", "pve", "pvp-season"] as const) {
		for (const [date, patch] of [
			["2025-11-14T23:59:59Z", "beta"],
			["2025-11-15T00:00:00Z", "1.0.0.0"],
			["2026-08-03T00:00:00Z", "1.1.0.0.46608"],
			["2026-09-08T00:00:00Z", "1.1.5.0.47242"],
			["2026-09-14T23:59:59Z", "1.1.5.0.47242"],
			["2026-09-15T00:00:00Z", "1.1.5.0.47426"],
		])
			assert.equal(resolveItemRelease(Date.parse(date), mode), patch);
		assert.equal(resolveItemRelease(null, mode), undefined);
	}
});

test("release association uses inclusive dates and isolated modes, independent of entry order", () => {
	const timeline = parseReleaseTimeline({ releases: [second, first] });
	const at = Date.parse(second.releasedAt);
	assert.equal(resolveItemRelease(at, "pvp-season", null, null, timeline), "1.2.0.0");
	assert.equal(resolveItemRelease(at - 1, "pvp-season", null, null, timeline), "1.1.5.0");
	assert.equal(resolveItemRelease(at, "regular", null, null, timeline), "1.1.5.0");
	assert.equal(resolveItemRelease(Date.parse(first.releasedAt) - 1, "regular", null, null, timeline), undefined);
});

test("correcting the timeline reassigns existing timestamps without changing the observation", () => {
	const observedAt = Date.parse("2026-09-15T00:00:00Z");
	assert.equal(resolveItemRelease(observedAt, "regular", "1.1.5.0", null, []), undefined);
	const timeline = parseReleaseTimeline({ releases: [{ ...first, patch: "1.2.0.0" }] });
	assert.equal(resolveItemRelease(observedAt, "regular", "1.1.5.0", null, timeline), "1.2.0.0");
	assert.equal(resolveItemRelease(null, "regular", null, null, timeline), undefined);
	assert.equal(resolveItemRelease(null, "regular", "pre-1.1.5", "baseline", timeline), "pre-1.1.5");
	assert.equal(resolveItemRelease(observedAt, "regular", "1.1.5.0", "imported", []), "1.1.5.0");
});

test("release config rejects malformed and ambiguous entries", () => {
	for (const entry of [
		{ ...first, releasedAt: "2026-02-30T00:00:00Z" },
		{ ...first, releasedAt: "2026-09-01" },
		{ ...first, modes: ["PVP"] },
		{ ...first, modes: [] },
		{ ...first, patch: "latest" },
		{ ...first, patch: "1.1.5.0.47242.1" },
		{ ...first, patch: "beta" },
		{ ...first, releasedAt: null },
	])
		assert.throws(() => parseReleaseTimeline({ releases: [entry] }));
	assert.throws(() => parseReleaseTimeline({ releases: [first, first] }), /Duplicate/);
	assert.deepEqual(parseReleaseTimeline({ releases: [] }), []);
});
