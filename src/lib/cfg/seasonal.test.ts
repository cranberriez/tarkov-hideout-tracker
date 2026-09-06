import assert from "node:assert/strict";
import test from "node:test";
import { getSeasonalCraftingSettings } from "./seasonal";
import { craftingTimeReduction } from "../price-calculation/crafting-skill";

test("KORD seasonal rule overrides every saved skill with Elite", () => {
  for (const savedLevel of [0, 25, 50, 51]) {
    const settings = getSeasonalCraftingSettings("KORD", savedLevel);
    assert.equal(settings.craftingSkillLevel, 51);
    assert.equal(settings.craftingSkillForced, true);
    assert.equal(craftingTimeReduction(settings.craftingSkillLevel), 0.375);
    assert.match(settings.craftingSkillNote!, /Season 1 KORD Breach/);
  }
});

test("permanent profiles retain their saved skill and editable controls", () => {
  for (const mode of ["PVP", "PVE"] as const) {
    for (const savedLevel of [0, 25, 50, 51]) {
      assert.deepEqual(getSeasonalCraftingSettings(mode, savedLevel), {
        craftingSkillLevel: savedLevel,
        craftingSkillForced: false,
        craftingSkillNote: undefined,
      });
    }
  }
});
