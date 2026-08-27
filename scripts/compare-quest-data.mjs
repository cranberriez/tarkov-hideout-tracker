import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function extractCoreQuests(value) {
    if (Array.isArray(value)) return value;
    if (isObject(value) && Array.isArray(value.quests)) return value.quests;
    throw new Error("quests_core must be an array or an object containing quests[]");
}

function extractTarkovTasks(value) {
    const candidates = [value, value?.data, value?.payload, value?.result];
    for (const candidate of candidates) {
        if (!isObject(candidate)) continue;
        if (Array.isArray(candidate.tasks)) return candidate.tasks;
        if (isObject(candidate.tasks)) return Object.values(candidate.tasks);
    }
    if (Array.isArray(value)) return value;
    throw new Error("Tarkov.dev snapshot must contain a tasks array or record");
}

function countBy(values, keyFor) {
    const counts = {};
    for (const value of values) {
        const key = String(keyFor(value));
        counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.fromEntries(
        Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
    );
}

function requirementType(requirement) {
    return String(requirement?.requirementType ?? "unknown").trim().toLowerCase();
}

function taskTraderId(task) {
    return typeof task.trader === "string" ? task.trader : task.trader?.id ?? null;
}

function requirementTraderId(requirement) {
    return typeof requirement?.trader === "string"
        ? requirement.trader
        : requirement?.trader?.id ?? null;
}

function ownTraderLevels(task) {
    const traderId = taskTraderId(task);
    return (task.traderRequirements ?? [])
        .filter((requirement) => {
            const type = requirementType(requirement);
            return (
                requirementTraderId(requirement) === traderId &&
                (type === "level" || type === "loyaltylevel") &&
                Number.isFinite(requirement.value)
            );
        })
        .map((requirement) => requirement.value);
}

function apiDerivedTier(task) {
    const levels = ownTraderLevels(task);
    if (levels.length === 0) return 1;
    return Math.min(4, Math.max(1, Math.round(Math.max(...levels))));
}

function summarizeRequirement(requirement) {
    return {
        traderId: requirementTraderId(requirement),
        type: requirement.requirementType ?? null,
        compareMethod: requirement.compareMethod ?? null,
        value: requirement.value ?? null,
    };
}

function normalizedName(value) {
    return String(value ?? "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function parseArguments(argv) {
    const positional = [];
    let writeOverrides = null;
    for (let index = 0; index < argv.length; index += 1) {
        if (argv[index] === "--write-overrides") {
            writeOverrides = argv[index + 1];
            if (!writeOverrides) throw new Error("--write-overrides requires a path");
            index += 1;
        } else {
            positional.push(argv[index]);
        }
    }
    return {
        corePath: positional[0] ?? "src/lib/data/quests_core.json",
        tarkovPath: positional[1] ?? "src/lib/data/tasks-pvp-season.json",
        writeOverrides,
    };
}

export function compareQuestData(coreDocument, tarkovDocument) {
    const coreQuests = extractCoreQuests(coreDocument);
    const tarkovTasks = extractTarkovTasks(tarkovDocument);
    const coreById = new Map(coreQuests.map((quest) => [quest.id, quest]));
    const tarkovById = new Map(tarkovTasks.map((task) => [task.id, task]));
    const commonIds = [...coreById.keys()].filter((id) => tarkovById.has(id)).sort();
    const coreOnly = coreQuests
        .filter((quest) => !tarkovById.has(quest.id))
        .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
    const tarkovOnly = tarkovTasks
        .filter((task) => !coreById.has(task.id))
        .sort((left, right) => left.id.localeCompare(right.id));

    const numericComparisons = [];
    const essential = [];
    const uncategorized = [];
    for (const id of commonIds) {
        const core = coreById.get(id);
        const task = tarkovById.get(id);
        const derivedTier = apiDerivedTier(task);
        const allTraderRequirements = (task.traderRequirements ?? []).map(summarizeRequirement);
        if (core.traderTab === "essential") {
            essential.push({
                id,
                name: core.name,
                trader: core.trader,
                apiDerivedTier: derivedTier,
                apiTraderRequirements: allTraderRequirements,
            });
        } else if ([1, 2, 3, 4].includes(core.traderTab)) {
            numericComparisons.push({
                id,
                name: core.name,
                trader: core.trader,
                coreTraderTab: core.traderTab,
                apiDerivedTier: derivedTier,
                matches: core.traderTab === derivedTier,
                apiHasExplicitOwnTraderLevel: ownTraderLevels(task).length > 0,
                apiTraderRequirements: allTraderRequirements,
            });
        } else {
            uncategorized.push({
                id,
                name: core.name,
                trader: core.trader,
                apiDerivedTier: derivedTier,
                apiHasExplicitOwnTraderLevel: ownTraderLevels(task).length > 0,
                apiTraderRequirements: allTraderRequirements,
            });
        }
    }

    const taskRequirementCounts = tarkovTasks.map(
        (task) => task.taskRequirements?.length ?? 0,
    );
    const traderRequirementCounts = tarkovTasks.map(
        (task) => task.traderRequirements?.length ?? 0,
    );
    const knownTaskIds = new Set(tarkovTasks.map((task) => task.id));
    const missingPrerequisiteTargets = [];
    for (const task of tarkovTasks) {
        for (const requirement of task.taskRequirements ?? []) {
            const prerequisiteId =
                typeof requirement.task === "string"
                    ? requirement.task
                    : requirement.task?.id ?? requirement.taskId ?? null;
            if (prerequisiteId && !knownTaskIds.has(prerequisiteId)) {
                missingPrerequisiteTargets.push({
                    questId: task.id,
                    prerequisiteId,
                    statuses: requirement.status ?? [],
                });
            }
        }
    }

    const conflicts = numericComparisons.filter((entry) => !entry.matches);
    const matching = numericComparisons.filter((entry) => entry.matches);
    const apiExplicitTierButCoreUncategorized = uncategorized.filter(
        (entry) => entry.apiHasExplicitOwnTraderLevel,
    );

    const overrides = Object.fromEntries(
        coreQuests
            .filter((quest) => [1, 2, 3, 4, "essential"].includes(quest.traderTab))
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((quest) => [quest.id, { traderTab: quest.traderTab }]),
    );

    return {
        summary: {
            coreQuests: coreQuests.length,
            tarkovDevTasks: tarkovTasks.length,
            exactIdMatches: commonIds.length,
            coreOnly: coreOnly.length,
            tarkovDevOnly: tarkovOnly.length,
            coreTraderTabValues: countBy(
                coreQuests,
                (quest) => quest.traderTab ?? "missing",
            ),
            numericTraderTabsCompared: numericComparisons.length,
            numericTraderTabsMatchingApiDerivedTier: matching.length,
            numericTraderTabConflicts: conflicts.length,
            essentialMatches: essential.length,
            uncategorizedMatches: uncategorized.length,
            apiExplicitTierButCoreUncategorized:
                apiExplicitTierButCoreUncategorized.length,
            suggestedOverrideCount: Object.keys(overrides).length,
        },
        methodology: {
            joinKey: "id",
            numericTierRule:
                "Highest issuing-trader level/loyaltyLevel requirement; defaults to LL1 when absent; cross-trader gates do not set the tier.",
            essentialRule:
                "Reported separately because essential is series/category metadata, not a loyalty requirement.",
            nameFallback:
                "Not used. IDs are authoritative; normalized names are diagnostic only.",
        },
        requirements: {
            taskRequirementCountDistribution: countBy(taskRequirementCounts, (value) => value),
            traderRequirementCountDistribution: countBy(
                traderRequirementCounts,
                (value) => value,
            ),
            traderRequirementTypeDistribution: countBy(
                tarkovTasks.flatMap((task) => task.traderRequirements ?? []),
                requirementType,
            ),
            missingPrerequisiteTargets,
        },
        traderTabComparison: {
            conflicts,
            apiExplicitTierButCoreUncategorized,
            essential,
        },
        uncategorizedTraderTabs: {
            byTrader: countBy(
                coreQuests.filter((quest) => quest.traderTab == null),
                (quest) => quest.trader ?? "unknown",
            ),
            records: coreQuests
                .filter((quest) => quest.traderTab == null)
                .sort(
                    (left, right) =>
                        left.trader.localeCompare(right.trader) ||
                        left.name.localeCompare(right.name) ||
                        left.id.localeCompare(right.id),
                )
                .map((quest) => ({
                    id: quest.id,
                    name: quest.name,
                    trader: quest.trader,
                    inTarkovDevSnapshot: tarkovById.has(quest.id),
                    modes: quest.modes ?? [],
                    confirmedInGame: quest.confirmedInGame ?? null,
                    removedFromGame: quest.removedFromGame ?? false,
                })),
        },
        missingQuests: {
            coreOnly: coreOnly.map((quest) => ({
                id: quest.id,
                name: quest.name,
                trader: quest.trader,
                traderTab: quest.traderTab ?? null,
                modes: quest.modes ?? [],
                confirmedInGame: quest.confirmedInGame ?? null,
                removedFromGame: quest.removedFromGame ?? false,
            })),
            tarkovDevOnly: tarkovOnly.map((task) => ({
                id: task.id,
                name: task.name ?? null,
                normalizedName: normalizedName(task.normalizedName ?? task.name),
                traderId: taskTraderId(task),
            })),
        },
        overrides: {
            version: 1,
            source: "quests_core.json",
            joinKey: "quest id",
            values: overrides,
        },
    };
}

async function main() {
    const options = parseArguments(process.argv.slice(2));
    const [coreText, tarkovText] = await Promise.all([
        fs.readFile(options.corePath, "utf8"),
        fs.readFile(options.tarkovPath, "utf8"),
    ]);
    const coreDocument = JSON.parse(coreText);
    const report = compareQuestData(coreDocument, JSON.parse(tarkovText));

    if (options.writeOverrides) {
        const overridePath = path.resolve(options.writeOverrides);
        const generatedAt = coreDocument.generatedAt ?? null;
        const output = { ...report.overrides, generatedAt };
        await fs.mkdir(path.dirname(overridePath), { recursive: true });
        await fs.writeFile(overridePath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    }

    const printableReport = { ...report };
    delete printableReport.overrides;
    process.stdout.write(`${JSON.stringify(printableReport, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    main().catch((error) => {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
    });
}
