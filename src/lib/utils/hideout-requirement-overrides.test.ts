import assert from "node:assert/strict";
import test from "node:test";
import { resolveHideoutRequirementValues } from "./hideout-requirement-overrides";

test("keeps the seasonal count and FiR flag authoritative", () => {
    assert.deepEqual(
        resolveHideoutRequirementValues({
            gameMode: "pvp-season",
            upstreamCount: 2,
            upstreamFoundInRaid: false,
            reviewedQuantity: 8,
            reviewedFoundInRaid: true,
            fallbackFoundInRaid: true,
        }),
        { count: 2, isFir: false },
    );
});

test("retains reviewed corrections for regular and PVE hideouts", () => {
    for (const gameMode of ["regular", "pve"] as const) {
        assert.deepEqual(
            resolveHideoutRequirementValues({
                gameMode,
                upstreamCount: 2,
                upstreamFoundInRaid: false,
                reviewedQuantity: 8,
                reviewedFoundInRaid: true,
                fallbackFoundInRaid: false,
            }),
            { count: 8, isFir: true },
        );
    }
});
