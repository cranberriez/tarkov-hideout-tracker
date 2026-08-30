import assert from "node:assert/strict";
import test from "node:test";
import {
    parseGameMode,
    readActiveGameModeCookie,
    serializeActiveGameModeCookie,
    toTarkovJsonGameMode,
} from "./game-mode";

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
    assert.equal(parseGameMode("PVP-SEASON"), "KORD");
});

test("reads and writes the server data-selection cookie", () => {
    assert.equal(
        readActiveGameModeCookie("theme=dark; tarkov-active-game-mode=KORD; compact=true"),
        "KORD",
    );
    assert.equal(readActiveGameModeCookie("theme=dark"), null);
    assert.match(serializeActiveGameModeCookie("PVE"), /^tarkov-active-game-mode=PVE;/);
});
