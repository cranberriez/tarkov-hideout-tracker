import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PREFIXES = ["Gunsmith", "The Huntsman Path"];
const SOURCE_ORDER = ["numbered-name", "same-trader-prerequisite", "repeated-prefix"];

function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTaskRecord(value) {
    return (
        isObject(value) &&
        typeof (value.id ?? value.taskId ?? value._id) === "string" &&
        (typeof value.name === "string" ||
            typeof value.title === "string" ||
            typeof value.normalizedName === "string" ||
            Array.isArray(value.taskRequirements))
    );
}

function parseJsonString(value, label) {
    try {
        return JSON.parse(value);
    } catch (error) {
        throw new Error(`Could not parse ${label} as JSON: ${error.message}`);
    }
}

function extractRecords(value, pathLabel = "root") {
    if (typeof value === "string") {
        return extractRecords(parseJsonString(value, pathLabel), `${pathLabel} (body)`);
    }

    if (Array.isArray(value)) {
        return { records: value, shape: `${pathLabel} array` };
    }

    if (!isObject(value)) {
        throw new Error("Task snapshot must contain a JSON object or array");
    }

    if (typeof value.body === "string") {
        return extractRecords(value.body, `${pathLabel}.body`);
    }

    for (const key of ["data", "payload", "result"]) {
        if (value[key] !== undefined) {
            try {
                return extractRecords(value[key], `${pathLabel}.${key}`);
            } catch (error) {
                if (key !== "data") throw error;
            }
        }
    }

    for (const key of ["tasks", "quests"]) {
        if (Array.isArray(value[key])) {
            return { records: value[key], shape: `${pathLabel}.${key} array` };
        }
        if (isObject(value[key])) {
            return {
                records: Object.values(value[key]),
                shape: `${pathLabel}.${key} record`,
            };
        }
    }

    if (isTaskRecord(value)) {
        return { records: [value], shape: `${pathLabel} task` };
    }

    const values = Object.values(value);
    if (values.length > 0 && values.every(isTaskRecord)) {
        return { records: values, shape: `${pathLabel} task record` };
    }

    throw new Error(
        "Could not find a task or quest array/record. Expected tasks, quests, data, or body.",
    );
}

function asText(value) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeKey(value) {
    return String(value ?? "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

function slugify(value) {
    return normalizeKey(value).replace(/\s+/g, "-") || "unnamed";
}

function getId(record) {
    return asText(record.id ?? record.taskId ?? record._id);
}

function getTraderId(record) {
    const trader = record.trader ?? record.traderId;
    if (typeof trader === "string") return asText(trader);
    if (isObject(trader)) {
        return asText(trader.id ?? trader.normalizedName ?? trader.name);
    }
    return null;
}

function getFaction(record) {
    const faction = asText(record.factionName ?? record.faction);
    return faction ? faction.toUpperCase() : null;
}

function getPrerequisites(record) {
    if (!Array.isArray(record.taskRequirements)) return [];

    return record.taskRequirements
        .map((requirement) => {
            if (typeof requirement === "string") return requirement.trim();
            if (!isObject(requirement)) return null;

            const task = requirement.task ?? requirement.taskId;
            if (typeof task === "string") return task.trim();
            if (isObject(task)) return asText(task.id);
            return null;
        })
        .filter((id) => id);
}

function getNumberedName(name) {
    const match = name.match(/^(.+?)\s*(?:[-:]\s*)?part\s+(\d+)\s*$/i);
    if (!match) return null;

    const baseName = match[1].replace(/[\s:-]+$/, "").trim();
    if (!baseName) return null;
    return { baseName, part: Number(match[2]) };
}

function normalizeRecord(record, index) {
    if (!isObject(record)) {
        return { invalid: { index, reason: "record is not an object" } };
    }

    const id = getId(record);
    const name = asText(record.name ?? record.title ?? record.normalizedName);
    if (!id) return { invalid: { index, reason: "record has no id" } };
    if (!name) return { invalid: { index, reason: "record has no name" } };

    const numbered = getNumberedName(name);
    return {
        task: {
            id,
            name,
            nameKey: normalizeKey(name),
            traderId: getTraderId(record),
            faction: getFaction(record),
            prerequisiteIds: [...new Set(getPrerequisites(record))].sort(),
            numberedBaseKey: numbered ? normalizeKey(numbered.baseName) : null,
            numberedBaseName: numbered?.baseName ?? null,
            numberedPart: numbered?.part ?? null,
        },
    };
}

function indexTasks(tasks) {
    const byId = new Map();
    const duplicateIds = new Map();

    for (const task of tasks) {
        const previous = byId.get(task.id);
        if (previous) {
            const ids = duplicateIds.get(task.id) ?? [previous.id];
            ids.push(task.id);
            duplicateIds.set(task.id, ids);
            continue;
        }
        byId.set(task.id, task);
    }

    return { byId, duplicateIds };
}

function buildEdges(tasks, byId) {
    const edges = [];
    for (const task of tasks) {
        for (const prerequisiteId of task.prerequisiteIds) {
            const prerequisite = byId.get(prerequisiteId);
            if (!prerequisite) continue;
            edges.push({
                from: prerequisite.id,
                to: task.id,
                sameTrader:
                    prerequisite.traderId !== null &&
                    task.traderId !== null &&
                    prerequisite.traderId === task.traderId,
                crossTrader:
                    prerequisite.traderId !== null &&
                    task.traderId !== null &&
                    prerequisite.traderId !== task.traderId,
            });
        }
    }
    return edges.sort((a, b) =>
        a.from.localeCompare(b.from) || a.to.localeCompare(b.to),
    );
}

function buildUndirectedComponents(taskIds, edges) {
    const neighbors = new Map(taskIds.map((id) => [id, new Set()]));
    for (const edge of edges) {
        if (!neighbors.has(edge.from) || !neighbors.has(edge.to)) continue;
        neighbors.get(edge.from).add(edge.to);
        neighbors.get(edge.to).add(edge.from);
    }

    const components = [];
    const visited = new Set();
    for (const id of [...taskIds].sort()) {
        if (visited.has(id) || neighbors.get(id).size === 0) continue;
        const component = [];
        const stack = [id];
        visited.add(id);
        while (stack.length > 0) {
            const current = stack.pop();
            component.push(current);
            for (const neighbor of [...neighbors.get(current)].sort().reverse()) {
                if (visited.has(neighbor)) continue;
                visited.add(neighbor);
                stack.push(neighbor);
            }
        }
        components.push(component.sort());
    }
    return components;
}

function topologicalOrder(memberIds, edges) {
    const members = new Set(memberIds);
    const outgoing = new Map(memberIds.map((id) => [id, []]));
    const indegree = new Map(memberIds.map((id) => [id, 0]));
    for (const edge of edges) {
        if (!members.has(edge.from) || !members.has(edge.to)) continue;
        outgoing.get(edge.from).push(edge.to);
        indegree.set(edge.to, indegree.get(edge.to) + 1);
    }

    const ready = [...memberIds].filter((id) => indegree.get(id) === 0).sort();
    const ordered = [];
    while (ready.length > 0) {
        const id = ready.shift();
        ordered.push(id);
        for (const child of [...outgoing.get(id)].sort()) {
            const next = indegree.get(child) - 1;
            indegree.set(child, next);
            if (next === 0) {
                ready.push(child);
                ready.sort();
            }
        }
    }

    if (ordered.length !== memberIds.length) {
        ordered.push(...memberIds.filter((id) => !ordered.includes(id)).sort());
    }
    return ordered;
}

function memberDetails(memberIds, byId, explicitParts = false) {
    return memberIds.map((id, index) => {
        const task = byId.get(id);
        const member = {
            questId: task.id,
            name: task.name,
            traderId: task.traderId,
            faction: task.faction,
            prerequisiteIds: task.prerequisiteIds,
        };
        if (explicitParts) member.part = task.numberedPart;
        else member.order = index + 1;
        return member;
    });
}

function candidateFlags(memberIds, byId, edges) {
    const members = new Set(memberIds);
    const names = new Map();
    const factions = new Set();
    const traders = new Set();
    const incoming = new Map(memberIds.map((id) => [id, 0]));
    const outgoing = new Map(memberIds.map((id) => [id, 0]));
    const internalEdges = edges.filter((edge) => members.has(edge.from) && members.has(edge.to));

    for (const id of memberIds) {
        const task = byId.get(id);
        const nameIds = names.get(task.nameKey) ?? [];
        nameIds.push(id);
        names.set(task.nameKey, nameIds);
        if (task.faction) factions.add(task.faction);
        if (task.traderId) traders.add(task.traderId);
    }
    for (const edge of internalEdges) {
        incoming.set(edge.to, incoming.get(edge.to) + 1);
        outgoing.set(edge.from, outgoing.get(edge.from) + 1);
    }

    const flags = new Set();
    if ([...names.values()].some((ids) => ids.length > 1)) flags.add("duplicate-names");
    if (factions.size > 1) flags.add("faction-variants");
    if (traders.size > 1) flags.add("cross-trader-members");
    if (internalEdges.some((edge) => edge.crossTrader)) flags.add("cross-trader-chain");
    if (
        [...incoming.values()].some((count) => count > 1) ||
        [...outgoing.values()].some((count) => count > 1)
    ) {
        flags.add("branches");
    }

    return [...flags].sort();
}

function makeCandidate({ id, source, label, memberIds, byId, edges, evidence, explicitParts = false }) {
    const orderedIds = explicitParts
        ? [...memberIds].sort(
              (a, b) =>
                  (byId.get(a).numberedPart ?? Number.MAX_SAFE_INTEGER) -
                      (byId.get(b).numberedPart ?? Number.MAX_SAFE_INTEGER) ||
                  a.localeCompare(b),
          )
        : topologicalOrder(memberIds, edges);
    return {
        id,
        source,
        label,
        flags: candidateFlags(orderedIds, byId, edges),
        evidence,
        members: memberDetails(orderedIds, byId, explicitParts),
    };
}

function addGroupedCandidates(groups, source, byId, edges, candidates) {
    for (const [key, group] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        if (group.length < 2) continue;
        const label = group[0].label;
        const memberIds = group.map((task) => task.id).sort();
        candidates.push(
            makeCandidate({
                id: `${source}:${slugify(key)}`,
                source,
                label,
                memberIds,
                byId,
                edges,
                evidence: group[0].evidence,
                explicitParts: source === "numbered-name",
            }),
        );
    }
}

function generateCandidates(tasks, byId, edges) {
    const candidates = [];

    const numberedGroups = new Map();
    for (const task of tasks) {
        if (!task.numberedBaseKey) continue;
        const key = task.numberedBaseKey;
        const group = numberedGroups.get(key) ?? [];
        group.push({
            ...task,
            label: task.numberedBaseName,
            evidence: { baseName: task.numberedBaseName },
        });
        numberedGroups.set(key, group);
    }
    addGroupedCandidates(numberedGroups, "numbered-name", byId, edges, candidates);

    const sameTraderEdges = edges.filter((edge) => edge.sameTrader);
    const components = buildUndirectedComponents(
        tasks.filter((task) => task.traderId !== null).map((task) => task.id),
        sameTraderEdges,
    );
    for (const memberIds of components) {
        if (memberIds.length < 2) continue;
        const traderIds = [...new Set(memberIds.map((id) => byId.get(id).traderId))].sort();
        candidates.push(
            makeCandidate({
                id: `same-trader-prerequisite:${slugify(traderIds[0] ?? "unknown")}:${memberIds[0]}`,
                source: "same-trader-prerequisite",
                label: `Same-trader prerequisite chain (${traderIds[0] ?? "unknown trader"})`,
                memberIds,
                byId,
                edges: sameTraderEdges,
                evidence: { traderId: traderIds[0] ?? null, edgeCount: sameTraderEdges.filter((edge) => memberIds.includes(edge.from) && memberIds.includes(edge.to)).length },
            }),
        );
    }

    const repeatedPrefixGroups = new Map();
    for (const prefix of PREFIXES) {
        const prefixKey = normalizeKey(prefix);
        const group = tasks.filter((task) => {
            const nameKey = task.nameKey;
            return nameKey === prefixKey || nameKey.startsWith(`${prefixKey} `);
        });
        if (group.length < 2) continue;
        repeatedPrefixGroups.set(prefixKey, group.map((task) => ({
            ...task,
            label: prefix,
            evidence: { prefix },
        })));
    }
    addGroupedCandidates(repeatedPrefixGroups, "repeated-prefix", byId, edges, candidates);

    return candidates.sort(
        (a, b) =>
            SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source) ||
            a.id.localeCompare(b.id),
    );
}

function buildIssues(tasks, byId, duplicateIds, edges, candidates) {
    const issues = [];
    for (const [id, duplicateValues] of [...duplicateIds.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        issues.push({ type: "duplicate-ids", questIds: duplicateValues, key: id });
    }

    const names = new Map();
    for (const task of tasks) {
        const group = names.get(task.nameKey) ?? [];
        group.push(task.id);
        names.set(task.nameKey, group);
    }
    for (const [nameKey, questIds] of [...names.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        if (questIds.length < 2) continue;
        issues.push({ type: "duplicate-names", nameKey, questIds: [...questIds].sort() });
    }

    for (const edge of edges.filter((candidate) => candidate.crossTrader)) {
        const from = byId.get(edge.from);
        const to = byId.get(edge.to);
        issues.push({
            type: "cross-trader-chain",
            prerequisiteQuestId: edge.from,
            questId: edge.to,
            traderIds: [from.traderId, to.traderId],
        });
    }

    for (const candidate of candidates) {
        for (const flag of candidate.flags) {
            if (flag === "duplicate-names" || flag === "faction-variants" || flag === "branches") {
                issues.push({
                    type: flag,
                    candidateId: candidate.id,
                    questIds: candidate.members.map((member) => member.questId),
                });
            }
        }
    }

    return issues.sort((a, b) =>
        a.type.localeCompare(b.type) ||
        String(a.candidateId ?? a.prerequisiteQuestId ?? a.key ?? "").localeCompare(
            String(b.candidateId ?? b.prerequisiteQuestId ?? b.key ?? ""),
        ) ||
        JSON.stringify(a).localeCompare(JSON.stringify(b)),
    );
}

export function generateQuestSeriesCandidates(snapshot) {
    const extracted = extractRecords(snapshot);
    const normalized = extracted.records.map(normalizeRecord);
    const invalidRecords = normalized
        .filter((entry) => entry.invalid)
        .map((entry) => entry.invalid)
        .sort((a, b) => a.index - b.index);
    const tasks = normalized
        .filter((entry) => entry.task)
        .map((entry) => entry.task)
        .sort((a, b) => a.id.localeCompare(b.id));
    const { byId, duplicateIds } = indexTasks(tasks);
    const uniqueTasks = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
    const edges = buildEdges(uniqueTasks, byId);
    const candidates = generateCandidates(uniqueTasks, byId, edges);

    return {
        schemaVersion: 1,
        input: {
            shape: extracted.shape,
            recordCount: extracted.records.length,
            validRecordCount: tasks.length,
            invalidRecords,
        },
        candidates,
        issues: buildIssues(uniqueTasks, byId, duplicateIds, edges, candidates),
    };
}

function usage() {
    return [
        "Usage: npm run quest-series-candidates -- <task-snapshot.json>",
        "   or: npm run quest-series-candidates -- --input <task-snapshot.json>",
        "",
        "Reads a downloaded task snapshot and prints a deterministic review report to stdout.",
        "The command never writes files or changes production quest organization.",
    ].join("\n");
}

function getInputPath(args) {
    if (args.includes("--help") || args.includes("-h")) return null;
    const inputIndex = args.indexOf("--input");
    if (inputIndex >= 0) return args[inputIndex + 1] ?? null;
    const inputFlag = args.find((arg) => arg.startsWith("--input="));
    if (inputFlag) return inputFlag.slice("--input=".length);
    return args.find((arg) => !arg.startsWith("-")) ?? null;
}

export async function main(args = process.argv.slice(2)) {
    const inputPath = getInputPath(args);
    if (!inputPath || args.includes("--help") || args.includes("-h")) {
        const output = usage();
        if (!inputPath) {
            console.error(output);
            return 1;
        }
        console.log(output);
        return 0;
    }

    const resolvedPath = path.resolve(process.cwd(), inputPath);
    let snapshot;
    try {
        snapshot = JSON.parse(await fs.readFile(resolvedPath, "utf8"));
    } catch (error) {
        console.error(`Could not read task snapshot ${resolvedPath}: ${error.message}`);
        return 1;
    }

    try {
        console.log(JSON.stringify(generateQuestSeriesCandidates(snapshot), null, 2));
        return 0;
    } catch (error) {
        console.error(error.message);
        return 1;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exitCode = await main();
}
