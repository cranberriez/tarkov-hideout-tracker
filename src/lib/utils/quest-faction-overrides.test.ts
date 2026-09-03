import assert from "node:assert/strict";
import test from "node:test";

import {
    applyQuestFactionOverrides,
    getQuestFactionOverride,
} from "./quest-faction-overrides";
import {
    buildQuestAvailabilityMap,
    isQuestAvailableForProfile,
    toQuestAvailabilityQuest,
} from "./quest-availability";
import type { FullQuest } from "@/types/quests";

const OIL_RUN_ID = "59c124d686f774189b3c843f";
const DEBTOR_ID = "639dbaf17c898a131e1cffff";

function makeQuest(id = OIL_RUN_ID, name = "Oil Run"): FullQuest {
    return {
        id,
        name,
        normalizedName: name.toLowerCase().replaceAll(" ", "-"),
        factionName: "Any",
        experience: 0,
        trader: {
            id: "54cb50c76803fa8b248b4571",
            name: "Prapor",
            normalizedName: "prapor",
        },
        taskRequirements: [],
        traderRequirements: [],
        otherRequirements: [],
        objectives: [],
    };
}

test("corrects known quests to BEAR by quest ID without mutating provider data", () => {
    const oilRun = makeQuest();
    const debtor = makeQuest(DEBTOR_ID, "Debtor");
    const unrelatedQuest = makeQuest("unrelated", "Unrelated");
    const [correctedOilRun, unchangedQuest] = applyQuestFactionOverrides([
        oilRun,
        unrelatedQuest,
    ]);

    assert.equal(getQuestFactionOverride(OIL_RUN_ID), "BEAR");
    assert.equal(getQuestFactionOverride(DEBTOR_ID), "BEAR");
    assert.equal(getQuestFactionOverride("unknown-quest-id"), null);
    assert.equal(oilRun.factionName, "Any");
    assert.equal(debtor.factionName, "Any");
    assert.equal(correctedOilRun.factionName, "BEAR");
    assert.equal(applyQuestFactionOverrides([debtor])[0].factionName, "BEAR");
    assert.strictEqual(unchangedQuest, unrelatedQuest);
});

test("makes corrected quests available to BEAR profiles and unavailable to USEC profiles", () => {
    const correctedQuests = applyQuestFactionOverrides([
        makeQuest(),
        makeQuest(DEBTOR_ID, "Debtor"),
    ]).map(toQuestAvailabilityQuest);
    const questsById = buildQuestAvailabilityMap(correctedQuests);
    const baseProfile = {
        playerLevel: 99,
        prestigeLevel: 0,
        traderLoyaltyLevels: {},
        completedQuests: {},
    };

    for (const quest of correctedQuests) {
        assert.equal(
            isQuestAvailableForProfile(
                quest,
                { ...baseProfile, faction: "BEAR" },
                questsById,
            ),
            true,
        );
        assert.equal(
            isQuestAvailableForProfile(
                quest,
                { ...baseProfile, faction: "USEC" },
                questsById,
            ),
            false,
        );
    }
});
