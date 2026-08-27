import assert from "node:assert/strict";
import test from "node:test";
import { parseGameMode, toTarkovJsonGameMode } from "./game-mode";

test("maps app profile names to Tarkov JSON prefixes", () => {
    assert.equal(toTarkovJsonGameMode("PVP"), "regular");
    assert.equal(toTarkovJsonGameMode("PVE"), "pve");
    assert.equal(toTarkovJsonGameMode("KORD"), "pvp-season");
});

test("parses cookie and route values without treating KORD as regular PVP", () => {
    assert.equal(parseGameMode("pvp"), "PVP");
    assert.equal(parseGameMode("PVE"), "PVE");
    assert.equal(parseGameMode("kord"), "KORD");
    assert.equal(parseGameMode("pvp-season"), "KORD");
});
