import assert from "node:assert/strict";
import test from "node:test";

import type { FullQuest } from "../../types/types.ts";
import {
    aggregateQuestEvents,
    dedupeQuestEvents,
    filterQuestLogFiles,
    parseQuestLogFile,
    parseQuestLogFiles,
    selectionLooksLikeEftLogsFolder,
} from "./quest-log-parser.ts";

function makeQuest(overrides: Partial<FullQuest> & Pick<FullQuest, "id" | "name">): FullQuest {
    return {
        id: overrides.id,
        name: overrides.name,
        normalizedName: overrides.normalizedName ?? overrides.name.toLowerCase().replace(/\s+/g, "-"),
        experience: overrides.experience ?? 1000,
        trader: overrides.trader ?? {
            id: "prapor",
            name: "Prapor",
            normalizedName: "prapor",
            imageLink: null,
            image4xLink: null,
        },
        taskRequirements: overrides.taskRequirements ?? [],
        traderRequirements: overrides.traderRequirements ?? [],
        requiredPrestige: overrides.requiredPrestige ?? null,
        objectives: overrides.objectives ?? [],
        wikiLink: overrides.wikiLink ?? null,
        minPlayerLevel: overrides.minPlayerLevel ?? 1,
        kappaRequired: overrides.kappaRequired ?? false,
        lightkeeperRequired: overrides.lightkeeperRequired ?? false,
        factionName: overrides.factionName ?? null,
        map: overrides.map ?? null,
    };
}

test("parseQuestLogFile tags pvp and pve quest events from the latest preceding signals", () => {
    const logText = `
2026-05-15 10:00:00.000 {"type":"userConfirmed","raidMode":"Online","mode":"deathmatch"}
2026-05-15 10:00:05.000 Got notification | ChatMessageReceived
{
  "message": {
    "type": 10,
    "templateId": "quest-alpha description [prapor] [0]",
    "uid": "54cb50c76803fa8b248b4571",
    "hasRewards": false
  }
}
2026-05-15 10:00:08.000 https://gw-pve.escapefromtarkov.com/push/notifications
2026-05-15 10:00:09.000 Got notification | ChatMessageReceived
{
  "message": {
    "type": 12,
    "templateId": "quest-alpha successMessageText [prapor] [0]",
    "uid": "54cb50c76803fa8b248b4571",
    "hasRewards": true,
    "items": {
      "data": [
        {
          "_tpl": "reward-bolts",
          "upd": {
            "StackObjectsCount": 2,
            "SpawnedInSession": true
          }
        }
      ]
    }
  }
}`;

    const events = parseQuestLogFile(logText, "push-notifications_000.log");

    assert.equal(events.length, 2);
    assert.equal(events[0]?.raidMode, "pvp");
    assert.equal(events[1]?.raidMode, "pve");
    assert.equal(events[1]?.rewards[0]?.templateId, "reward-bolts");
    assert.equal(events[1]?.rewards[0]?.spawnedInSession, true);
});

test("parseQuestLogFile inherits pvp mode from a prior multiline UserConfirmed payload", () => {
    const logText = `
2026-05-15 10:00:00.000 UserConfirmed
{
  "type": "userConfirmed",
  "raidMode": "Online",
  "mode": "deathmatch"
}
2026-05-15 10:00:05.000 Got notification | ChatMessageReceived
{
  "message": {
    "type": 12,
    "templateId": "quest-alpha successMessageText [prapor] [0]",
    "uid": "54cb50c76803fa8b248b4571",
    "hasRewards": false
  }
}`;

    const events = parseQuestLogFile(logText, "push-notifications_000.log");

    assert.equal(events.length, 1);
    assert.equal(events[0]?.raidMode, "pvp");
});

test("dedupeQuestEvents collapses repeated deliveries within one second and keeps tally", () => {
    const events = parseQuestLogFile(
        `
2026-05-15 10:00:00.000 {"type":"userConfirmed","mode":"deathmatch"}
2026-05-15 10:00:05.000 Got notification | ChatMessageReceived
{
  "message": {
    "type": 12,
    "templateId": "quest-alpha successMessageText [prapor] [0]",
    "uid": "54cb50c76803fa8b248b4571",
    "hasRewards": false
  }
}
2026-05-15 10:00:05.700 Got notification | ChatMessageReceived
{
  "message": {
    "type": 12,
    "templateId": "quest-alpha successMessageText [prapor] [0]",
    "uid": "54cb50c76803fa8b248b4571",
    "hasRewards": false
  }
}`,
        "push-notifications_001.log",
    );

    const deduped = dedupeQuestEvents(events);
    const groups = aggregateQuestEvents(deduped);

    assert.equal(deduped.length, 1);
    assert.equal(deduped[0]?.occurrenceCount, 2);
    assert.equal(groups[0]?.occurrenceCount, 2);
    assert.equal(groups[0]?.eventCount, 1);
});

test("parseQuestLogFiles separates unresolved quest ids and unknown raid mode", () => {
    const result = parseQuestLogFiles(
        [
            {
                name: "push-notifications_010.log",
                text: `
2026-05-15 10:00:05.000 Got notification | ChatMessageReceived
{
  "message": {
    "type": 10,
    "templateId": "quest-missing description [prapor] [0]",
    "uid": "54cb50c76803fa8b248b4571",
    "hasRewards": false
  }
}`,
            },
            {
                name: "other.log",
                text: "ignored",
            },
        ],
        [makeQuest({ id: "quest-known", name: "Known Quest" })],
    );

    assert.equal(result.totals.filesScanned, 2);
    assert.equal(result.totals.filesParsed, 1);
    assert.equal(result.totals.filesIgnored, 1);
    assert.equal(result.totals.unknownEvents, 1);
    assert.equal(result.resolvedGroups.length, 0);
    assert.equal(result.unresolvedGroups.length, 1);
    assert.equal(result.unresolvedGroups[0]?.questId, "quest-missing");
});

test("filterQuestLogFiles only keeps push-notification logs inside Logs or log_* folders", () => {
    const files = [
        {
            name: "push-notifications_001.log",
            webkitRelativePath: "Logs/log_2026_05_15/push-notifications_001.log",
        },
        {
            name: "push-notifications_002.log",
            webkitRelativePath: "Desktop/push-notifications_002.log",
        },
        {
            name: "application.log",
            webkitRelativePath: "Logs/log_2026_05_15/application.log",
        },
    ];

    const result = filterQuestLogFiles(files);

    assert.deepEqual(result.matched.map((file) => file.name), ["push-notifications_001.log"]);
    assert.equal(selectionLooksLikeEftLogsFolder(files), true);
});

test("selectionLooksLikeEftLogsFolder rejects selections without Logs or log_* paths", () => {
    const files = [
        {
            name: "random.txt",
            webkitRelativePath: "Users/jakev/Documents/random.txt",
        },
    ];

    assert.equal(selectionLooksLikeEftLogsFolder(files), false);
});
