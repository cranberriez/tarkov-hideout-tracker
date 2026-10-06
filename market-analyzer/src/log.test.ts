import test from "node:test";
import assert from "node:assert/strict";
import { formatDuration, formatPretty, parseLogFormat } from "./log";

const at = "2026-09-28T14:42:37.627Z";

test("routine events are one readable line", () => {
	assert.equal(
		formatPretty({
			at,
			event: "poll",
			mode: "pvp-season",
			checked: 3597,
			updated: 12,
			notModified: 3585,
			failed: 0,
			excluded: 0,
			durationMs: 2411,
		}),
		"2026-09-28 14:42:37 INFO  [pvp-season] poll · 3,597 checked · 12 changed · 3,585 unchanged · 0 failed · 0 newly excluded · 2.4s",
	);
	assert.equal(
		formatPretty({ at, event: "flush", mode: "pve", status: "idle", durationMs: 0 }),
		"2026-09-28 14:42:37 INFO  [pve]        push skipped · nothing changed",
	);
	const analysis = formatPretty({
		at,
		event: "analysis",
		mode: "regular",
		status: "succeeded",
		startedAt: 0,
		completedAt: 900,
		analyzedCount: 3755,
		unchangedCount: 0,
		missingCount: 0,
		trend: { rising: 581, falling: 597, stable: 1395, unknown: 1182 },
		confidence: { high: 571, medium: 1692, low: 1492 },
		failed: [],
	});
	assert.match(
		analysis,
		/analysis succeeded · 3,755 observations .* trend ↑ 581 ↓ 597 → 1,395 \? 1,182 · confidence high 571 med 1,692 low 1,492 · 900ms$/,
	);
	assert.equal(analysis.split("\n").length, 1);
});

test("errors add the cause chain and hints as detail lines", () => {
	const output = formatPretty({
		at,
		event: "database-unreachable",
		target: "localhost:5555/tarkov",
		error: "Failed query: select 1 <- caused by: connect ECONNREFUSED 127.0.0.1:5555",
		hint: "Use host.docker.internal.",
	});
	assert.deepEqual(output.split("\n"), [
		"2026-09-28 14:42:37 ERROR database unreachable · localhost:5555/tarkov",
		"    ↳ Failed query: select 1",
		"    ↳ caused by: connect ECONNREFUSED 127.0.0.1:5555",
		"    ↳ hint: Use host.docker.internal.",
	]);
	assert.match(
		formatPretty({ at, event: "mode-error", mode: "pve", error: "boom", retryInSeconds: 300 }),
		/ERROR \[pve\] +step failed · retrying in 5m 00s\n {4}↳ boom/,
	);
});

test("run-now events describe what will run", () => {
	assert.equal(
		formatPretty({ at, event: "run-now-started", mode: "pvp-season", steps: ["poll", "analyze"] }),
		"2026-09-28 14:42:37 INFO  [pvp-season] running now (outside schedule) · poll + analyze",
	);
	assert.equal(
		formatPretty({ at, event: "run-requested", source: "run-now", request: "pve:analyze" }),
		"2026-09-28 14:42:37 INFO  run requested via run-now · pve:analyze",
	);
});

test("unknown events fall back to key=value", () => {
	assert.equal(
		formatPretty({ at, event: "custom", mode: "pve", count: 2, extra: { a: 1 } }),
		'2026-09-28 14:42:37 INFO  [pve]        custom count=2 extra={"a":1}',
	);
});

test("colour only wraps when requested", () => {
	assert.ok(!formatPretty({ at, event: "worker-stopped" }).includes("\x1b["));
	assert.ok(formatPretty({ at, event: "worker-stopped" }, true).includes("\x1b[32mINFO"));
});

test("format parsing and durations", () => {
	assert.equal(parseLogFormat(undefined), "json");
	assert.equal(parseLogFormat(" Pretty "), "pretty");
	assert.throws(() => parseLogFormat("fancy"), /json or pretty/);
	assert.equal(formatDuration(65_000), "1m 05s");
	assert.equal(formatDuration(2 * 3_600_000 + 5 * 60_000), "2h 05m");
});
