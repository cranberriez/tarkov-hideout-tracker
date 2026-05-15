import type { FullQuest } from "../../types/types.ts";

export type ParsedRaidMode = "pvp" | "pve" | "unknown";
export type ParsedQuestEventType = "started" | "completed";

export interface QuestLogReward {
    templateId: string;
    stackCount?: number;
    spawnedInSession?: boolean;
}

export interface ParsedQuestEvent {
    timestamp: Date | null;
    timestampMs: number | null;
    type: ParsedQuestEventType;
    raidMode: ParsedRaidMode;
    questId: string;
    traderId: string | null;
    hasRewards: boolean;
    rewards: QuestLogReward[];
    sourceFile: string;
    occurrenceCount: number;
    rawTemplateId: string;
}

export interface AggregatedQuestEvent {
    questId: string;
    type: ParsedQuestEventType;
    raidMode: ParsedRaidMode;
    firstTimestamp: Date | null;
    latestTimestamp: Date | null;
    eventCount: number;
    occurrenceCount: number;
    hasRewards: boolean;
    traderIds: string[];
    sourceFiles: string[];
}

export interface ResolvedAggregatedQuestEvent extends AggregatedQuestEvent {
    quest: FullQuest | null;
}

export interface QuestLogParseTotals {
    filesScanned: number;
    filesParsed: number;
    filesIgnored: number;
    rawEvents: number;
    dedupedEvents: number;
    startedEvents: number;
    completedEvents: number;
    pvpEvents: number;
    pveEvents: number;
    unknownEvents: number;
}

export interface QuestLogParseResult {
    totals: QuestLogParseTotals;
    filteredFiles: string[];
    ignoredFiles: string[];
    events: ParsedQuestEvent[];
    groups: AggregatedQuestEvent[];
    resolvedGroups: ResolvedAggregatedQuestEvent[];
    unresolvedGroups: ResolvedAggregatedQuestEvent[];
}

export interface QuestLogFileLike {
    name: string;
    webkitRelativePath?: string;
}

export interface QuestLogFileInput extends QuestLogFileLike {
    text: string;
}

interface JsonBlockResult {
    jsonText: string;
    endIndex: number;
}

const PUSH_NOTIFICATION_FILE_PATTERN = /push-notifications.*\.log$/i;
const CHAT_MESSAGE_TRIGGER = "Got notification | ChatMessageReceived";
const PVE_SIGNAL_PATTERNS = ["wsn-pve-", "gw-pve.escapefromtarkov.com"];

export function filterQuestLogFiles<T extends QuestLogFileLike>(files: T[]) {
    const matched: T[] = [];
    const ignored: T[] = [];

    for (const file of files) {
        if (isRelevantQuestLogFile(file)) {
            matched.push(file);
        } else {
            ignored.push(file);
        }
    }

    return { matched, ignored };
}

export function selectionLooksLikeEftLogsFolder<T extends QuestLogFileLike>(files: T[]) {
    return files.some((file) => hasAllowedLogFolderPath(file));
}

export function parseQuestLogFile(text: string, fileName: string): ParsedQuestEvent[] {
    const lines = text.split(/\r?\n/);
    const events: ParsedQuestEvent[] = [];
    let currentRaidMode: ParsedRaidMode = "unknown";

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        const lowerLine = line.toLowerCase();

        if (isPveSignal(lowerLine)) {
            currentRaidMode = "pve";
        } else {
            const raidModeSignal = extractRaidModeSignal(lines, index);
            if (raidModeSignal) {
                currentRaidMode = raidModeSignal.raidMode;
                index = raidModeSignal.endIndex;
                continue;
            }
        }

        if (!line.includes(CHAT_MESSAGE_TRIGGER)) {
            continue;
        }

        const jsonBlock = collectJsonBlock(lines, index + 1);
        if (!jsonBlock) {
            continue;
        }

        const event = parseQuestEventBlock(jsonBlock.jsonText, {
            fileName,
            raidMode: currentRaidMode,
            timestamp: parseTimestampFromLine(line),
        });

        if (event) {
            events.push(event);
        }

        index = jsonBlock.endIndex;
    }

    return events;
}

export function parseQuestLogFiles(files: QuestLogFileInput[], quests: FullQuest[]): QuestLogParseResult {
    const { matched, ignored } = filterQuestLogFiles(files);
    const rawEvents = matched.flatMap((file) => parseQuestLogFile(file.text, file.name));
    const dedupedEvents = dedupeQuestEvents(rawEvents);
    const groups = aggregateQuestEvents(dedupedEvents);
    const { resolved, unresolved } = resolveQuestEventGroups(groups, quests);

    return {
        totals: {
            filesScanned: files.length,
            filesParsed: matched.length,
            filesIgnored: ignored.length,
            rawEvents: rawEvents.length,
            dedupedEvents: dedupedEvents.length,
            startedEvents: dedupedEvents.filter((event) => event.type === "started").length,
            completedEvents: dedupedEvents.filter((event) => event.type === "completed").length,
            pvpEvents: dedupedEvents.filter((event) => event.raidMode === "pvp").length,
            pveEvents: dedupedEvents.filter((event) => event.raidMode === "pve").length,
            unknownEvents: dedupedEvents.filter((event) => event.raidMode === "unknown").length,
        },
        filteredFiles: matched.map((file) => file.name),
        ignoredFiles: ignored.map((file) => file.name),
        events: dedupedEvents,
        groups,
        resolvedGroups: resolved,
        unresolvedGroups: unresolved,
    };
}

export function dedupeQuestEvents(events: ParsedQuestEvent[]): ParsedQuestEvent[] {
    const buckets = new Map<string, ParsedQuestEvent[]>();

    for (const event of events) {
        const bucketKey = `${event.questId}|${event.type}|${event.raidMode}`;
        const bucket = buckets.get(bucketKey) ?? [];
        const existing = bucket.find((candidate) => isDuplicateQuestEvent(candidate, event));

        if (existing) {
            existing.occurrenceCount += event.occurrenceCount;
            if (event.timestampMs !== null && (existing.timestampMs ?? -Infinity) < event.timestampMs) {
                existing.timestamp = event.timestamp;
                existing.timestampMs = event.timestampMs;
            }
            if (event.hasRewards) {
                existing.hasRewards = true;
            }
            if (event.rewards.length > 0 && existing.rewards.length === 0) {
                existing.rewards = event.rewards;
            }
            if (!existing.traderId && event.traderId) {
                existing.traderId = event.traderId;
            }
            continue;
        }

        const clone: ParsedQuestEvent = {
            ...event,
            rewards: [...event.rewards],
        };
        bucket.push(clone);
        buckets.set(bucketKey, bucket);
    }

    return Array.from(buckets.values())
        .flat()
        .sort((left, right) => (right.timestampMs ?? 0) - (left.timestampMs ?? 0));
}

export function aggregateQuestEvents(events: ParsedQuestEvent[]): AggregatedQuestEvent[] {
    const groups = new Map<string, AggregatedQuestEvent>();

    for (const event of events) {
        const key = `${event.questId}|${event.type}|${event.raidMode}`;
        const existing = groups.get(key);

        if (!existing) {
            groups.set(key, {
                questId: event.questId,
                type: event.type,
                raidMode: event.raidMode,
                firstTimestamp: event.timestamp,
                latestTimestamp: event.timestamp,
                eventCount: 1,
                occurrenceCount: event.occurrenceCount,
                hasRewards: event.hasRewards,
                traderIds: event.traderId ? [event.traderId] : [],
                sourceFiles: [event.sourceFile],
            });
            continue;
        }

        existing.eventCount += 1;
        existing.occurrenceCount += event.occurrenceCount;
        existing.hasRewards = existing.hasRewards || event.hasRewards;

        if (event.timestampMs !== null) {
            if (
                existing.latestTimestamp === null ||
                event.timestampMs > existing.latestTimestamp.getTime()
            ) {
                existing.latestTimestamp = event.timestamp;
            }
            if (
                existing.firstTimestamp === null ||
                event.timestampMs < existing.firstTimestamp.getTime()
            ) {
                existing.firstTimestamp = event.timestamp;
            }
        }

        if (event.traderId && !existing.traderIds.includes(event.traderId)) {
            existing.traderIds.push(event.traderId);
        }
        if (!existing.sourceFiles.includes(event.sourceFile)) {
            existing.sourceFiles.push(event.sourceFile);
        }
    }

    return Array.from(groups.values()).sort((left, right) => {
        const leftTime = left.latestTimestamp?.getTime() ?? 0;
        const rightTime = right.latestTimestamp?.getTime() ?? 0;
        return rightTime - leftTime || left.questId.localeCompare(right.questId);
    });
}

export function resolveQuestEventGroups(groups: AggregatedQuestEvent[], quests: FullQuest[]) {
    const questsById = new Map(quests.map((quest) => [quest.id, quest]));
    const resolved: ResolvedAggregatedQuestEvent[] = [];
    const unresolved: ResolvedAggregatedQuestEvent[] = [];

    for (const group of groups) {
        const resolvedGroup: ResolvedAggregatedQuestEvent = {
            ...group,
            traderIds: [...group.traderIds],
            sourceFiles: [...group.sourceFiles],
            quest: questsById.get(group.questId) ?? null,
        };

        if (resolvedGroup.quest) {
            resolved.push(resolvedGroup);
        } else {
            unresolved.push(resolvedGroup);
        }
    }

    return { resolved, unresolved };
}

function parseQuestEventBlock(
    jsonText: string,
    context: {
        fileName: string;
        raidMode: ParsedRaidMode;
        timestamp: Date | null;
    },
): ParsedQuestEvent | null {
    try {
        const parsed = JSON.parse(jsonText) as Record<string, unknown>;
        const message = getMessagePayload(parsed);
        if (!message) {
            return null;
        }

        const rawTemplateId = getString(message.templateId);
        if (!rawTemplateId) {
            return null;
        }

        const [questId, suffix = ""] = rawTemplateId.trim().split(/\s+/, 2);
        if (!questId) {
            return null;
        }

        const eventType = getQuestEventType(message.type, suffix);
        if (!eventType) {
            return null;
        }

        const timestampMs = context.timestamp ? context.timestamp.getTime() : null;

        return {
            timestamp: context.timestamp,
            timestampMs,
            type: eventType,
            raidMode: context.raidMode,
            questId,
            traderId: getString(message.uid),
            hasRewards: Boolean(message.hasRewards),
            rewards: extractRewards(message.items),
            sourceFile: context.fileName,
            occurrenceCount: 1,
            rawTemplateId,
        };
    } catch {
        return null;
    }
}

function getQuestEventType(
    rawType: unknown,
    suffix: string,
): ParsedQuestEventType | null {
    if (rawType === 10) return "started";
    if (rawType === 12) return "completed";
    if (suffix === "description") return "started";
    if (suffix === "successMessageText") return "completed";
    return null;
}

function extractRewards(rawItems: unknown): QuestLogReward[] {
    const items = getRecord(rawItems)?.data;
    if (!Array.isArray(items)) {
        return [];
    }

    const rewards: QuestLogReward[] = [];

    for (const item of items) {
        const record = getRecord(item);
        if (!record) {
            continue;
        }

        const upd = getRecord(record.upd);
        const stackCount = getNumber(upd?.StackObjectsCount) ?? getNumber(record.stackCount);
        const spawnedInSession = getBoolean(upd?.SpawnedInSession) ?? getBoolean(record.spawnedInSession);
        const templateId = getString(record._tpl) ?? getString(record.templateId);

        if (!templateId) {
            continue;
        }

        rewards.push({
            templateId,
            stackCount: stackCount ?? undefined,
            spawnedInSession: spawnedInSession ?? undefined,
        });
    }

    return rewards;
}

function getMessagePayload(parsed: Record<string, unknown>) {
    const directMessage = getRecord(parsed.message);
    if (directMessage) {
        return directMessage;
    }

    const payloadData = getRecord(parsed.data);
    const nestedMessage = payloadData ? getRecord(payloadData.message) : null;
    if (nestedMessage) {
        return nestedMessage;
    }

    return parsed;
}

function collectJsonBlock(lines: string[], startIndex: number): JsonBlockResult | null {
    let firstLineWithBrace = -1;

    for (let index = startIndex; index < lines.length; index += 1) {
        if ((lines[index] ?? "").includes("{")) {
            firstLineWithBrace = index;
            break;
        }
    }

    if (firstLineWithBrace === -1) {
        return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;
    let foundOpeningBrace = false;
    const collected: string[] = [];

    for (let index = firstLineWithBrace; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        collected.push(line);

        for (const character of line) {
            if (escaped) {
                escaped = false;
                continue;
            }

            if (character === "\\") {
                escaped = true;
                continue;
            }

            if (character === '"') {
                inString = !inString;
                continue;
            }

            if (inString) {
                continue;
            }

            if (character === "{") {
                depth += 1;
                foundOpeningBrace = true;
            } else if (character === "}") {
                depth -= 1;
                if (foundOpeningBrace && depth === 0) {
                    return {
                        jsonText: collected.join("\n"),
                        endIndex: index,
                    };
                }
            }
        }
    }

    return null;
}

function parseTimestampFromLine(line: string): Date | null {
    const match = line.match(
        /(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d{3,7})?(?:Z)?)/,
    );
    if (!match) {
        return null;
    }

    const normalized = match[1].replace(",", ".").replace(" ", "T");
    const timestamp = new Date(normalized);
    return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

function isDuplicateQuestEvent(left: ParsedQuestEvent, right: ParsedQuestEvent) {
    if (left.questId !== right.questId || left.type !== right.type || left.raidMode !== right.raidMode) {
        return false;
    }

    if (left.timestampMs === null || right.timestampMs === null) {
        return false;
    }

    return Math.abs(left.timestampMs - right.timestampMs) <= 1000;
}

function isPveSignal(line: string) {
    return PVE_SIGNAL_PATTERNS.some((pattern) => line.includes(pattern));
}

function isRelevantQuestLogFile(file: QuestLogFileLike) {
    return PUSH_NOTIFICATION_FILE_PATTERN.test(file.name) && hasAllowedLogFolderPath(file);
}

function hasAllowedLogFolderPath(file: QuestLogFileLike) {
    const relativePath = normalizePath(file.webkitRelativePath);
    if (!relativePath) {
        return true;
    }

    const segments = relativePath.split("/").filter(Boolean);
    return segments.some(
        (segment, index) =>
            (segment === "Logs" || segment.startsWith("log_")) &&
            index < segments.length - 1,
    );
}

function extractRaidModeSignal(lines: string[], index: number) {
    const line = lines[index] ?? "";
    const lowerLine = line.toLowerCase();
    if (!lowerLine.includes("userconfirmed")) {
        return null;
    }

    const inlineJson = extractInlineJson(line);
    if (inlineJson) {
        const raidMode = getRaidModeFromPayload(inlineJson);
        if (raidMode) {
            return { raidMode, endIndex: index };
        }
    }

    const jsonBlock = collectJsonBlock(lines, index);
    if (!jsonBlock) {
        return null;
    }

    const raidMode = parseRaidModeFromJson(jsonBlock.jsonText);
    if (!raidMode) {
        return null;
    }

    return { raidMode, endIndex: jsonBlock.endIndex };
}

function parseRaidModeFromJson(jsonText: string): ParsedRaidMode | null {
    try {
        const parsed = JSON.parse(jsonText) as Record<string, unknown>;
        return getRaidModeFromPayload(parsed);
    } catch {
        return null;
    }
}

function getRaidModeFromPayload(payload: Record<string, unknown>): ParsedRaidMode | null {
    const rawType = getString(payload.type)?.toLowerCase();
    const nestedData = getRecord(payload.data);
    const nestedType = nestedData ? getString(nestedData.type)?.toLowerCase() : null;
    const rawMode = getString(payload.mode)?.toLowerCase();
    const nestedMode = nestedData ? getString(nestedData.mode)?.toLowerCase() : null;
    const mode = rawMode ?? nestedMode;
    const type = rawType ?? nestedType;

    if (type !== "userconfirmed") {
        return null;
    }

    if (mode === "deathmatch") {
        return "pvp";
    }

    return null;
}

function extractInlineJson(line: string) {
    const braceIndex = line.indexOf("{");
    if (braceIndex === -1) {
        return null;
    }

    const candidate = line.slice(braceIndex).trim();
    try {
        return JSON.parse(candidate) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function normalizePath(path: string | undefined) {
    return path?.replace(/\\/g, "/");
}

function getRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

function getString(value: unknown) {
    return typeof value === "string" ? value : null;
}

function getNumber(value: unknown) {
    return typeof value === "number" ? value : null;
}

function getBoolean(value: unknown) {
    return typeof value === "boolean" ? value : null;
}
