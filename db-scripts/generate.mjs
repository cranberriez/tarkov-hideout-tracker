import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { once } from "node:events";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createJiti } from "jiti";
import {
    SNAPSHOT_SCHEMA_VERSION,
    assertSafeReleaseId,
    createReleaseId,
    hashFile,
} from "./lib/snapshot.mjs";
import { loadLocalEnv, parseModes } from "./lib/config.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const defaultOutputRoot = path.join(scriptDirectory, ".generated");
const ITEM_VIEW_BATCH_SIZE = 12;

function parseArguments(argv) {
    const options = {
        modes: ["regular", "pve", "pvp-season"],
        releaseId: createReleaseId(),
        outputRoot: defaultOutputRoot,
        force: false,
    };
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === "--modes") options.modes = parseModes(argv[++index]);
        else if (argument === "--release") options.releaseId = assertSafeReleaseId(argv[++index]);
        else if (argument === "--output") options.outputRoot = path.resolve(argv[++index]);
        else if (argument === "--force") options.force = true;
        else throw new Error(`Unknown argument: ${argument}`);
    }
    return options;
}

function pickDefined(value) {
    return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined));
}

function withoutMarketPrice(item) {
    if (!item || typeof item !== "object") return item;
    const priceFreeItem = { ...item };
    delete priceFreeItem.marketPrice;
    return priceFreeItem;
}

function withoutViewPrices(viewType, payload) {
    if (viewType === "relations") {
        return {
            ...payload,
            item: payload.item ? withoutMarketPrice(payload.item) : null,
            relatedItems: payload.relatedItems.map(withoutMarketPrice),
        };
    }
    return {
        ...payload,
        items: payload.items.map(withoutMarketPrice),
    };
}

function itemPreview(item) {
    return pickDefined({
        id: item.id,
        name: item.name,
        normalizedName: item.normalizedName,
        shortName: item.shortName,
        iconLink: item.iconLink,
        gridImageLink: item.gridImageLink,
    });
}

function stationPreview(station) {
    return pickDefined({
        id: station.id,
        name: station.name,
        normalizedName: station.normalizedName,
        imageLink: station.imageLink,
        maxLevel: station.levels.reduce(
            (highest, level) => Math.max(highest, level.level),
            0,
        ),
    });
}

function questPreview(quest) {
    return pickDefined({
        id: quest.id,
        name: quest.name,
        normalizedName: quest.normalizedName,
        taskImageLink: quest.taskImageLink,
        wikiLink: quest.wikiLink,
        minPlayerLevel: quest.minPlayerLevel,
        kappaRequired: quest.kappaRequired,
        lightkeeperRequired: quest.lightkeeperRequired,
        factionName: quest.factionName,
        trader: quest.trader,
        map: quest.map,
    });
}

function recordsByIds(records, ids) {
    const result = {};
    for (const id of new Set(ids)) {
        const record = records.get(id);
        if (record) result[id] = record;
    }
    return result;
}

function makeResult(data, updatedAt) {
    return { data, updatedAt };
}

function createMemoryRepository(data) {
    const itemsById = new Map(data.items.map((item) => [item.id, item]));
    const questsById = new Map(data.quests.map((quest) => [quest.id, quest]));
    const tradersById = new Map(data.traders.map((trader) => [trader.id, trader]));
    const currentPrices = new Map(
        data.items.flatMap((item) =>
            item.marketPrice ? [[item.id, item.marketPrice]] : [],
        ),
    );

    return {
        items: {
            getCatalog: async () => makeResult(data.items, data.freshness.items),
            getByIds: async (_mode, ids) =>
                makeResult(recordsByIds(itemsById, ids), data.freshness.items),
        },
        hideout: {
            getStations: async () => makeResult(data.stations, data.freshness.stations),
        },
        quests: {
            getAll: async () => makeResult(data.quests, data.freshness.quests),
            getByIds: async (_mode, ids) =>
                makeResult(recordsByIds(questsById, ids), data.freshness.quests),
        },
        traders: {
            getAll: async () => makeResult(data.traders, data.freshness.traders),
            getByIds: async (_mode, ids) =>
                makeResult(recordsByIds(tradersById, ids), data.freshness.traders),
        },
        recipes: {
            getBarters: async () => makeResult(data.barters, data.freshness.barters),
            getCrafts: async () => makeResult(data.crafts, data.freshness.crafts),
        },
        prices: {
            getCurrent: async (_mode, ids) =>
                makeResult(recordsByIds(currentPrices, ids), data.freshness.items),
            getHistory: async () => {
                throw new Error("Price history is intentionally excluded from database snapshots");
            },
        },
    };
}

async function loadApplicationModules() {
    const jiti = createJiti(pathToFileURL(import.meta.url).href, {
        alias: { "@": path.join(projectRoot, "src") },
    });
    const importSource = (relativePath) =>
        jiti.import(path.join(projectRoot, relativePath));
    const [
        itemsService,
        hideoutService,
        questsService,
        tradersService,
        recipesService,
        relationsQuery,
        usageQuery,
        acquisitionQuery,
        nameUtils,
    ] = await Promise.all([
        importSource("src/server/services/itemsJson.ts"),
        importSource("src/server/services/hideoutJson.ts"),
        importSource("src/server/services/questsJson.ts"),
        importSource("src/server/services/tradersJson.ts"),
        importSource("src/server/services/itemAcquisitionJson.ts"),
        importSource("src/server/queries/getItemRelationsData.ts"),
        importSource("src/server/queries/getItemUsageData.ts"),
        importSource("src/server/queries/getItemAcquisitionTreeData.ts"),
        importSource("src/lib/utils/normalize-name.ts"),
    ]);
    return {
        itemsService,
        hideoutService,
        questsService,
        tradersService,
        recipesService,
        relationsQuery,
        usageQuery,
        acquisitionQuery,
        normalizeName: nameUtils.normalizeName,
    };
}

async function loadModeData(mode, modules) {
    const [items, skills, stations, quests, traders, barters, crafts] =
        await Promise.all([
            modules.itemsService.getGlobalItemList(mode),
            modules.itemsService.getGlobalSkillList(mode),
            modules.hideoutService.getJsonHideoutStations(mode),
            modules.questsService.getCurrentJsonFullQuestData(mode),
            modules.tradersService.getJsonTraders(mode),
            modules.recipesService.getBarterIndex(mode),
            modules.recipesService.getCraftIndex(mode),
        ]);
    return {
        items: items.data.items,
        skills: skills.data.skills,
        stations: stations.data.stations,
        quests: quests.data.quests,
        traders: traders.data.traders,
        barters: Object.values(barters.data.bartersByItemId).flat(),
        crafts: Object.values(crafts.data.craftsByItemId).flat(),
        freshness: {
            items: items.updatedAt,
            skills: skills.updatedAt,
            stations: stations.updatedAt,
            quests: quests.updatedAt,
            traders: traders.updatedAt,
            barters: barters.updatedAt,
            crafts: crafts.updatedAt,
        },
    };
}

async function prepareReleaseDirectory(outputRoot, releaseId, force) {
    const resolvedRoot = path.resolve(outputRoot);
    const releaseDirectory = path.resolve(resolvedRoot, releaseId);
    const relative = path.relative(resolvedRoot, releaseDirectory);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error("Release directory must be a child of the configured output directory");
    }
    await fsPromises.mkdir(resolvedRoot, { recursive: true });
    if (force) await fsPromises.rm(releaseDirectory, { recursive: true, force: true });
    await fsPromises.mkdir(releaseDirectory, { recursive: false });
    return releaseDirectory;
}

async function writeLine(stream, record) {
    if (!stream.write(`${JSON.stringify(record)}\n`)) await once(stream, "drain");
}

async function writeEntity(stream, counts, entityType, entityId, payload, updatedAt, sortKey) {
    await writeLine(stream, {
        type: "entity",
        entityType,
        entityId,
        ...(sortKey ? { sortKey } : {}),
        updatedAt,
        payload,
    });
    counts.entity += 1;
}

async function writeModeSnapshot(releaseDirectory, releaseId, mode, modules) {
    process.stdout.write(`Loading normalized ${mode} datasets…\n`);
    const data = await loadModeData(mode, modules);
    const repository = createMemoryRepository(data);
    const filename = `${mode}.ndjson`;
    const fullPath = path.join(releaseDirectory, filename);
    const stream = fs.createWriteStream(fullPath, { encoding: "utf8", flags: "wx" });
    const counts = { entity: 0, itemView: 0, itemSearch: 0, manifest: 0 };

    const entityGroups = [
        ["item", data.items.map(withoutMarketPrice), data.freshness.items],
        ["station", data.stations, data.freshness.stations],
        ["quest", data.quests, data.freshness.quests],
        ["trader", data.traders, data.freshness.traders],
        ["skill", data.skills, data.freshness.skills],
        ["barter", data.barters, data.freshness.barters],
        ["craft", data.crafts, data.freshness.crafts],
    ];
    for (const [entityType, records, updatedAt] of entityGroups) {
        for (const record of records) {
            await writeEntity(
                stream,
                counts,
                entityType,
                record.id,
                record,
                updatedAt,
                record.name?.toLocaleLowerCase("en") ?? record.id,
            );
        }
    }
    for (const item of data.items) {
        await writeEntity(
            stream,
            counts,
            "price",
            item.id,
            item.marketPrice ?? null,
            data.freshness.items,
            item.id,
        );
        const normalizedName = modules.normalizeName(item.name);
        const preview = itemPreview(item);
        await writeLine(stream, {
            type: "itemSearch",
            itemId: item.id,
            normalizedName,
            compactName: normalizedName.replaceAll("-", ""),
            sortName: item.name.toLocaleLowerCase("en"),
            payload: preview,
        });
        counts.itemSearch += 1;
    }

    const manifests = {
        items: {
            ids: data.items.map((item) => item.id),
            previews: data.items.map(itemPreview),
        },
        stations: {
            ids: data.stations.map((station) => station.id),
            previews: data.stations.map(stationPreview),
        },
        quests: {
            ids: data.quests.map((quest) => quest.id),
            previews: data.quests.map(questPreview),
        },
        traders: { ids: data.traders.map((trader) => trader.id), records: data.traders },
        skills: { ids: data.skills.map((skill) => skill.id), records: data.skills },
        barters: { ids: data.barters.map((barter) => barter.id) },
        crafts: { ids: data.crafts.map((craft) => craft.id) },
    };
    for (const [manifestName, payload] of Object.entries(manifests)) {
        await writeLine(stream, {
            type: "manifest",
            manifestName,
            updatedAt: data.freshness[manifestName] ?? Date.now(),
            payload,
        });
        counts.manifest += 1;
    }

    process.stdout.write(`Generating ${data.items.length} item read models for ${mode}…\n`);
    for (let start = 0; start < data.items.length; start += ITEM_VIEW_BATCH_SIZE) {
        const itemViews = await Promise.all(
            data.items.slice(start, start + ITEM_VIEW_BATCH_SIZE).map(async (item) => {
                const [relations, usage, acquisition] = await Promise.all([
                    modules.relationsQuery.getItemRelationsData(item.id, mode, repository),
                    modules.usageQuery.getItemUsageData(item.id, mode, repository),
                    modules.acquisitionQuery.getItemAcquisitionTreeData(item.id, mode, repository),
                ]);
                return {
                    itemId: item.id,
                    views: [
                        ["relations", relations],
                        ["usage", usage],
                        ["acquisition", acquisition],
                    ],
                };
            }),
        );
        for (const itemView of itemViews) {
            for (const [viewType, payload] of itemView.views) {
                await writeLine(stream, {
                    type: "itemView",
                    itemId: itemView.itemId,
                    viewType,
                    updatedAt: Date.now(),
                    payload: withoutViewPrices(viewType, payload),
                });
                counts.itemView += 1;
            }
        }
        const completed = Math.min(start + ITEM_VIEW_BATCH_SIZE, data.items.length);
        if (completed % 100 < ITEM_VIEW_BATCH_SIZE || completed === data.items.length) {
            process.stdout.write(`  ${mode}: ${completed}/${data.items.length}\n`);
        }
    }

    stream.end();
    await once(stream, "finish");
    return {
        mode,
        file: filename,
        sha256: await hashFile(fullPath),
        recordCounts: counts,
        entityCounts: Object.fromEntries(
            entityGroups.map(([entityType, records]) => [entityType, records.length]),
        ),
        sourceFreshness: data.freshness,
    };
}

async function main() {
    await loadLocalEnv(projectRoot);
    const options = parseArguments(process.argv.slice(2));
    const releaseDirectory = await prepareReleaseDirectory(
        options.outputRoot,
        options.releaseId,
        options.force,
    );
    const modules = await loadApplicationModules();
    const modes = [];
    for (const mode of options.modes) {
        modes.push(
            await writeModeSnapshot(
                releaseDirectory,
                options.releaseId,
                mode,
                modules,
            ),
        );
    }
    const manifest = {
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        releaseId: options.releaseId,
        generatedAt: Date.now(),
        priceHistoryIncluded: false,
        modes,
    };
    await fsPromises.writeFile(
        path.join(releaseDirectory, "manifest.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
        "utf8",
    );
    process.stdout.write(`Snapshot ready: ${releaseDirectory}\n`);
}

main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
});
