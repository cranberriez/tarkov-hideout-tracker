import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TARKOV_JSON_BASE_URL = "https://json.tarkov.dev";
const USER_AGENT = "TarkovHideoutTracker/1.0 (+https://tarkovhideout.com)";
const DEFAULT_GAME_MODE = "regular";
const DEFAULT_OUTPUT_ROOT = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../src/lib/data/map-overlays",
);

function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function records(value) {
    if (Array.isArray(value)) return value.filter(isRecord);
    if (isRecord(value)) return Object.values(value).filter(isRecord);
    return [];
}

function finiteNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function point(value) {
    if (!isRecord(value)) return null;
    const x = finiteNumber(value.x);
    const y = finiteNumber(value.y);
    const z = finiteNumber(value.z);
    return x === undefined || y === undefined || z === undefined ? null : { x, y, z };
}

function points(value) {
    return Array.isArray(value) ? value.map(point).filter(Boolean) : [];
}

function translated(value, translate) {
    return typeof value === "string" && value.length > 0 ? translate(value) : "";
}

function optionalNumber(target, key, value) {
    const normalized = finiteNumber(value);
    if (normalized !== undefined) target[key] = normalized;
}

export function reduceMapOverlays(payload, locale, gameMode = DEFAULT_GAME_MODE) {
    if (!isRecord(payload) || !isRecord(payload.maps)) {
        throw new Error("Tarkov map payload is missing data.maps");
    }
    if (!isRecord(locale) || Object.keys(locale).length === 0) {
        throw new Error("Tarkov map locale is empty");
    }

    const translate = (key) => typeof locale[key] === "string" ? locale[key] : key;
    const mobs = isRecord(payload.mobs) ? payload.mobs : {};
    const maps = records(payload.maps)
        .map((map) => {
            const id = typeof map.id === "string" ? map.id : "";
            const normalizedName = typeof map.normalizedName === "string" ? map.normalizedName : "";
            if (!id || !normalizedName) return null;

            const extracts = records(map.extracts)
                .map((extract) => {
                    const position = point(extract.position);
                    if (!position || typeof extract.id !== "string") return null;
                    const reduced = {
                        id: extract.id,
                        name: translated(extract.name, translate) || extract.id,
                        faction: typeof extract.faction === "string" ? extract.faction : "unknown",
                        position,
                    };
                    const outline = points(extract.outline);
                    if (outline.length > 0) reduced.outline = outline;
                    optionalNumber(reduced, "top", extract.top);
                    optionalNumber(reduced, "bottom", extract.bottom);
                    return reduced;
                })
                .filter(Boolean)
                .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));

            const transits = records(map.transits)
                .map((transit) => {
                    const position = point(transit.position);
                    if (!position || typeof transit.id !== "string") return null;
                    const destinationMap = typeof transit.map === "string" && isRecord(payload.maps[transit.map])
                        ? payload.maps[transit.map]
                        : null;
                    const destinationMapName = destinationMap
                        ? translated(destinationMap.name, translate) || destinationMap.normalizedName
                        : "Unknown destination";
                    const reduced = {
                        id: transit.id,
                        name: translated(transit.description, translate) || `Transit to ${destinationMapName}`,
                        destinationMapId: destinationMap && typeof destinationMap.id === "string" ? destinationMap.id : null,
                        destinationMapName,
                        position,
                    };
                    const outline = points(transit.outline);
                    if (outline.length > 0) reduced.outline = outline;
                    optionalNumber(reduced, "top", transit.top);
                    optionalNumber(reduced, "bottom", transit.bottom);
                    return reduced;
                })
                .filter(Boolean)
                .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));

            const bosses = records(map.bosses)
                .map((boss) => {
                    const mobKey = typeof boss.mob === "string" ? boss.mob : "";
                    const mob = isRecord(mobs[mobKey]) ? mobs[mobKey] : {};
                    const locations = records(boss.spawnLocations)
                        .map((location) => {
                            const positions = points(location.positions);
                            if (positions.length === 0) return null;
                            const spawnKey = typeof location.spawnKey === "string" ? location.spawnKey : "";
                            return {
                                name: translated(location.name, translate) || spawnKey || "Unknown area",
                                spawnKey,
                                chance: finiteNumber(location.chance) ?? 0,
                                positions,
                            };
                        })
                        .filter(Boolean)
                        .sort((left, right) => left.name.localeCompare(right.name) || left.spawnKey.localeCompare(right.spawnKey));
                    if (!mobKey || locations.length === 0) return null;

                    const reduced = {
                        id: typeof mob.id === "string" ? mob.id : mobKey,
                        name: translated(mob.name, translate) || mobKey,
                        normalizedName: typeof mob.normalizedName === "string" ? mob.normalizedName : mobKey,
                        spawnChance: finiteNumber(boss.spawnChance) ?? 0,
                        locations,
                    };
                    optionalNumber(reduced, "spawnTime", boss.spawnTime);
                    if (typeof boss.spawnTimeRandom === "boolean") reduced.spawnTimeRandom = boss.spawnTimeRandom;
                    if (typeof boss.spawnTrigger === "string" && boss.spawnTrigger.length > 0) {
                        reduced.spawnTrigger = boss.spawnTrigger;
                    }
                    return reduced;
                })
                .filter(Boolean)
                .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));

            return {
                id,
                name: translated(map.name, translate) || normalizedName,
                normalizedName,
                extracts,
                transits,
                bosses,
            };
        })
        .filter(Boolean)
        .sort((left, right) => left.normalizedName.localeCompare(right.normalizedName));

    if (maps.length === 0) throw new Error("Tarkov map payload contains no valid maps");

    return {
        schemaVersion: 1,
        source: {
            provider: "tarkov.dev JSON API",
            gameMode,
            mapsUrl: `${TARKOV_JSON_BASE_URL}/${gameMode}/maps`,
            localeUrl: `${TARKOV_JSON_BASE_URL}/${gameMode}/maps_en`,
        },
        maps,
    };
}

async function clearGeneratedJson(directory) {
    await mkdir(directory, { recursive: true });
    const entries = await readdir(directory, { withFileTypes: true });
    await Promise.all(entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => unlink(resolve(directory, entry.name))));
}

async function writeSnapshot(snapshot, outputRoot) {
    const extractsDirectory = resolve(outputRoot, "extracts");
    const bossesDirectory = resolve(outputRoot, "bosses");
    await Promise.all([
        clearGeneratedJson(extractsDirectory),
        clearGeneratedJson(bossesDirectory),
    ]);

    await Promise.all(snapshot.maps.flatMap((map) => {
        const pmcExtracts = map.extracts.filter((extract) => extract.faction === "pmc");
        const mapIdentity = {
            id: map.id,
            name: map.name,
            normalizedName: map.normalizedName,
        };
        return [
            writeFile(
                resolve(extractsDirectory, `${map.normalizedName}.json`),
                `${JSON.stringify({ schemaVersion: snapshot.schemaVersion, map: mapIdentity, extracts: pmcExtracts, transits: map.transits }, null, 2)}\n`,
                "utf8",
            ),
            writeFile(
                resolve(bossesDirectory, `${map.normalizedName}.json`),
                `${JSON.stringify({ schemaVersion: snapshot.schemaVersion, map: mapIdentity, bosses: map.bosses }, null, 2)}\n`,
                "utf8",
            ),
        ];
    }));

    const manifest = {
        schemaVersion: snapshot.schemaVersion,
        source: snapshot.source,
        maps: snapshot.maps.map((map) => ({
            id: map.id,
            name: map.name,
            normalizedName: map.normalizedName,
            extractCount: map.extracts.filter((extract) => extract.faction === "pmc").length,
            transitCount: map.transits.length,
            bossRuleCount: map.bosses.length,
        })),
    };
    await writeFile(resolve(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function fetchDataset(path) {
    const response = await fetch(`${TARKOV_JSON_BASE_URL}/${path}`, {
        headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) {
        throw new Error(`Tarkov JSON request failed for ${path}: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

async function main() {
    const gameMode = process.argv[2] || DEFAULT_GAME_MODE;
    const outputRoot = process.argv[3] ? resolve(process.argv[3]) : DEFAULT_OUTPUT_ROOT;
    const [baseResponse, localeResponse] = await Promise.all([
        fetchDataset(`${gameMode}/maps`),
        fetchDataset(`${gameMode}/maps_en`),
    ]);
    const snapshot = reduceMapOverlays(baseResponse.data, localeResponse.data, gameMode);
    await mkdir(outputRoot, { recursive: true });
    await writeSnapshot(snapshot, outputRoot);

    const extractCount = snapshot.maps.reduce(
        (sum, map) => sum + map.extracts.filter((extract) => extract.faction === "pmc").length,
        0,
    );
    const transitCount = snapshot.maps.reduce((sum, map) => sum + map.transits.length, 0);
    const bossCount = snapshot.maps.reduce((sum, map) => sum + map.bosses.length, 0);
    const bossPositionCount = snapshot.maps.reduce(
        (sum, map) => sum + map.bosses.reduce(
            (bossSum, boss) => bossSum + boss.locations.reduce(
                (locationSum, location) => locationSum + location.positions.length,
                0,
            ),
            0,
        ),
        0,
    );
    console.log(`Wrote ${snapshot.maps.length} map chunks, ${extractCount} PMC extracts, ${transitCount} transits, ${bossCount} boss spawn rules, and ${bossPositionCount} boss candidate positions to ${outputRoot}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
