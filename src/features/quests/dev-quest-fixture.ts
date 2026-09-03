import type { FullQuest, QuestMap } from "@/types/quests";

export const DEV_QUEST_QUERY = "dev-test";
export const DEV_QUEST_ID = "dev-test-quest";

const devTrader = {
    id: "dev-test-provider",
    name: "Development",
    normalizedName: "development",
    imageLink: null,
    image4xLink: null,
};

const prapor = {
    id: "54cb50c76803fa8b248b4571",
    name: "Prapor",
    normalizedName: "prapor",
    imageLink: null,
    image4xLink: null,
};

const fence = {
    id: "579dc571d53a0658a154fbec",
    name: "Fence",
    normalizedName: "fence",
    imageLink: null,
    image4xLink: null,
};

const customs: QuestMap = { id: "dev-customs", name: "Customs", normalizedName: "customs" };
const woods: QuestMap = { id: "dev-woods", name: "Woods", normalizedName: "woods" };
const shoreline: QuestMap = { id: "dev-shoreline", name: "Shoreline", normalizedName: "shoreline" };
const factory: QuestMap = { id: "dev-factory", name: "Factory", normalizedName: "factory" };

const questItem = {
    id: "dev-suspicious-data-drive",
    name: "Suspicious test data drive",
    normalizedName: "suspicious-test-data-drive",
    shortName: "TEST DRIVE",
    source: "questSpecific" as const,
};

function relationQuest(
    id: string,
    name: string,
    taskRequirements: FullQuest["taskRequirements"] = [],
): FullQuest {
    return {
        id,
        name,
        normalizedName: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        experience: 0,
        map: null,
        trader: devTrader,
        taskRequirements,
        failConditions: [],
        traderRequirements: [],
        otherRequirements: [],
        requiredPrestige: null,
        objectives: [],
    };
}

const prerequisiteQuest = relationQuest("dev-test-prerequisite", "Fake prerequisite: Warm the cache");
const completionUnlockQuest = relationQuest(
    "dev-test-unlock-complete",
    "Fake unlock: Ship the polished panel",
    [{ task: { id: DEV_QUEST_ID, name: "Development Quest: Everything Drawer" }, status: ["complete"] }],
);
const acceptanceUnlockQuest = relationQuest(
    "dev-test-unlock-active",
    "Fake unlock: Watch the layout squirm",
    [{ task: { id: DEV_QUEST_ID, name: "Development Quest: Everything Drawer" }, status: ["active"] }],
);

const alternativeQuest: FullQuest = {
    ...relationQuest("dev-test-alternative", "Fake alternative: Delete the CSS and flee"),
    failConditions: [{
        id: "dev-alt-fails-main-complete",
        type: "taskStatus",
        description: "Fail when the main development fixture is completed",
        optional: false,
        status: ["complete"],
        task: { id: DEV_QUEST_ID },
    }],
};

const mainQuest: FullQuest = {
    id: DEV_QUEST_ID,
    name: "Development Quest: Everything Drawer",
    normalizedName: DEV_QUEST_QUERY,
    taskImageLink: null,
    wikiLink: "https://example.com/dev-test-quest",
    minPlayerLevel: 42,
    kappaRequired: true,
    lightkeeperRequired: true,
    factionName: "USEC",
    experience: 123456,
    map: null,
    trader: devTrader,
    taskRequirements: [{
        task: { id: prerequisiteQuest.id, name: prerequisiteQuest.name },
        status: ["complete"],
    }],
    failConditions: [
        {
            id: "dev-main-fails-alternative-complete",
            type: "taskStatus",
            description: "Fail when the fake alternative is completed",
            optional: false,
            status: ["complete"],
            task: { id: alternativeQuest.id },
        },
        {
            id: "dev-main-fails-timeout",
            type: "timer",
            description: "Fail if the placeholder timer reaches zero",
            optional: true,
        },
    ],
    traderRequirements: [
        {
            id: "dev-prapor-level",
            trader: prapor,
            requirementType: "level",
            compareMethod: ">=",
            value: 3,
        },
        {
            id: "dev-fence-reputation",
            trader: fence,
            requirementType: "reputation",
            compareMethod: ">=",
            value: 2.5,
        },
    ],
    otherRequirements: [
        {
            id: "dev-fake-weather-gate",
            type: "weather",
            requirementType: "Fake weather gate",
            compareMethod: "=",
            value: "dramatic fog",
        },
        {
            id: "dev-fake-variable-gate",
            type: "globalVariable",
            requirementType: "Fake feature flag",
            variableId: "dev-only-layout-chaos",
            compareMethod: ">=",
            value: 7,
        },
    ],
    requiredPrestige: {
        id: "dev-prestige",
        name: "Development prestige",
        prestigeLevel: 2,
        imageLink: null,
        iconLink: null,
    },
    finishItemRewards: [
        { itemId: "5449016a4bdc2d6f028b456f", count: 987654 },
        { itemId: "544fb45d4bdc2dee738b4568", count: 12 },
        { itemId: "5755356824597772cb798962", count: 3 },
        { itemId: "57347c5b245977448d35f6e1", count: 25 },
        { itemId: "dev-missing-reward-item", count: 1 },
    ],
    finishTraderStandingRewards: [
        { trader: prapor, standing: 0.25 },
        { trader: fence, standing: -0.12 },
        { trader: devTrader, standing: 99.99 },
    ],
    failureTraderStandingRewards: [
        { trader: prapor, standing: -0.5 },
        { trader: fence, standing: 0.01 },
    ],
    objectives: [
        {
            id: "dev-objective-visit",
            type: "visit",
            description: "Visit several fake locations across Customs and Woods",
            optional: false,
            maps: [customs, woods],
            locations: [
                { map: customs, position: { x: 135, y: 3, z: -85 }, outline: [], source: "zone" },
                { map: customs, position: { x: -115, y: 6, z: 160 }, outline: [], source: "possibleLocation" },
                { map: woods, position: { x: 25, y: 12, z: 40 }, outline: [], source: "zone" },
            ],
            requiredKeyIds: [["5a13f46386f7741dd7384b04"], ["591afe0186f77431bd616a11", "593aa4be86f77457f56379f8"]],
        },
        {
            id: "dev-objective-find-items",
            type: "findItem",
            description: "Find three different medical or utility items in raid",
            optional: false,
            count: 3,
            foundInRaid: true,
            itemIds: ["544fb45d4bdc2dee738b4568", "5755356824597772cb798962", "5d02778e86f774203e7dedbe"],
            itemScope: "anyOf",
            maps: [shoreline],
        },
        {
            id: "dev-objective-give-items",
            type: "giveItem",
            description: "Hand over the medical or utility items",
            optional: false,
            count: 3,
            foundInRaid: true,
            itemIds: ["544fb45d4bdc2dee738b4568", "5755356824597772cb798962", "5d02778e86f774203e7dedbe"],
            itemScope: "anyOf",
        },
        {
            id: "dev-objective-plant-items",
            type: "plantItem",
            description: "Plant bolts and screw nuts in the extremely official test box",
            optional: true,
            count: 2,
            foundInRaid: false,
            itemIds: ["57347c5b245977448d35f6e1", "57347c77245977448d35f6e2"],
            itemScope: "specific",
            maps: [factory],
        },
        {
            id: "dev-objective-quest-item",
            type: "findQuestItem",
            description: "Pick up the suspicious test data drive",
            optional: false,
            questItem,
            count: 1,
            maps: [customs],
            locations: [
                { map: customs, position: { x: 42, y: 8, z: 42 }, outline: [], source: "possibleLocation" },
                { map: customs, position: { x: 48, y: 8, z: 39 }, outline: [], source: "possibleLocation" },
            ],
        },
        {
            id: "dev-objective-shoot",
            type: "shoot",
            description: "Eliminate 17 imaginary targets with deliberately awkward constraints",
            optional: false,
            count: 17,
            target: "Imaginary target",
            targetNames: ["Scav", "PMC", "Cardboard cutout"],
            shotType: "kill",
            zoneNames: ["Dorms", "Saw Mill"],
            bodyParts: ["Head", "Left leg"],
            maps: [customs, woods],
        },
        {
            id: "dev-objective-extract",
            type: "extract",
            description: "Extract from Shoreline while surviving, running through, or merely looking confident",
            optional: false,
            exitName: "Fake Developer Exit",
            exitStatus: ["Survived", "Runner"],
            zoneNames: ["Tunnel", "Road to Customs"],
            maps: [shoreline],
        },
        {
            id: "dev-objective-build",
            type: "buildItem",
            description: "Build an implausibly specific weapon preset",
            optional: false,
            itemId: "5447a9cd4bdc2dbd208b4567",
            containsAllItemIds: ["5649ae4a4bdc2d1b2b8b4588", "5649ab884bdc2ded0b8b457f"],
            containsCategoryIds: ["55818a594bdc2db9688b456a"],
            attributes: [
                { name: "Ergonomics", requirement: { compareMethod: ">=", value: 75 } },
                { name: "Weight", requirement: { compareMethod: "<=", value: 4.2 } },
            ],
        },
        {
            id: "dev-objective-hideout",
            type: "hideoutStation",
            description: "Upgrade the fake observability station",
            optional: false,
            hideoutStation: { id: "dev-station", name: "Observability Desk", normalizedName: "observability-desk" },
            stationLevel: 4,
        },
        {
            id: "dev-objective-trader-level",
            type: "traderLevel",
            description: "Reach Prapor loyalty level 4",
            optional: false,
            trader: prapor,
            level: 4,
        },
        {
            id: "dev-objective-standing",
            type: "traderStanding",
            description: "Reach a suspiciously precise Fence reputation",
            optional: false,
            trader: fence,
            compareMethod: ">=",
            value: 3.14,
        },
        {
            id: "dev-objective-player-level",
            type: "playerLevel",
            description: "Reach player level 60 for no defensible reason",
            optional: false,
            playerLevel: 60,
            count: 60,
        },
        {
            id: "dev-objective-use-item",
            type: "useItem",
            description: "Use any test medical item seven times in Factory office",
            optional: true,
            useAnyItemIds: ["544fb45d4bdc2dee738b4568", "5755356824597772cb798962"],
            compareMethod: ">=",
            count: 7,
            zoneNames: ["Factory office"],
            maps: [factory],
        },
    ],
};

export const DEV_QUEST_FIXTURES: FullQuest[] = [
    prerequisiteQuest,
    mainQuest,
    completionUnlockQuest,
    acceptanceUnlockQuest,
    alternativeQuest,
];

