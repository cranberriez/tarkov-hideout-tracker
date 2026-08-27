import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { generateQuestSeriesCandidates } from "./generate-quest-series-candidates.mjs";

const fixture = JSON.parse(
    await fs.readFile(new URL("./fixtures/quest-series-candidates.sample.json", import.meta.url), "utf8"),
);

test("generates deterministic candidates and review flags from a task record snapshot", () => {
    const first = generateQuestSeriesCandidates(fixture);
    const second = generateQuestSeriesCandidates(fixture);

    assert.deepEqual(first, second);
    assert.equal(first.input.validRecordCount, 6);
    assert.ok(first.candidates.some((candidate) => candidate.source === "numbered-name"));
    assert.ok(first.candidates.some((candidate) => candidate.source === "same-trader-prerequisite"));
    assert.ok(first.candidates.some((candidate) => candidate.source === "repeated-prefix"));
    assert.ok(first.issues.some((issue) => issue.type === "duplicate-names"));
    assert.ok(first.issues.some((issue) => issue.type === "faction-variants"));
    assert.ok(first.issues.some((issue) => issue.type === "branches"));
    assert.ok(first.issues.some((issue) => issue.type === "cross-trader-chain"));
});

test("unwraps a serialized fetch-cache body containing mapped quests", () => {
    const report = generateQuestSeriesCandidates({
        data: {
            body: JSON.stringify({
                quests: [
                    {
                        id: "mapped-quest",
                        name: "Mapped Quest",
                        trader: { id: "trader" },
                        taskRequirements: [],
                    },
                ],
            }),
        },
    });

    assert.equal(report.input.shape, "root.data.body (body).quests array");
    assert.equal(report.input.validRecordCount, 1);
    assert.deepEqual(report.candidates, []);
});
