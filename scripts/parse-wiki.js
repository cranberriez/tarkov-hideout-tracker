const fs = require("fs");
const path = require("path");

const inputFile = path.join(__dirname, "../wiki-src/hideout-reqs.txt");
const outputFile = path.join(__dirname, "../app/lib/data/hideout-data.json");

// Ensure output directory exists
const outputDir = path.dirname(outputFile);
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const rawContent = fs.readFileSync(inputFile, "utf8");

// Split by table start
const tables = rawContent.split('{| class="wikitable"');

console.log(`Found ${tables.length} potential tables`);

const stations = [];

// Helper to parse number
const parseNum = (str) => parseInt(str.replace(/,/g, ""), 10);

// Normalization function
const normalizeName = (name) => {
    return name
        .toLowerCase()
        .replace(/['"]/g, "")
        .replace(/[^a-z0-9\s-_]/g, "") // keep alphanumeric, space, dash, underscore
        .trim()
        .replace(/\s+/g, "-");
};

for (let t = 1; t < tables.length; t++) {
    const block = tables[t];

    // Extract Station Name
    const nameLineMatch = block.match(/! colspan=4 \| (.*)/);
    if (!nameLineMatch) continue;

    let rawName = nameLineMatch[1].trim();
    // Remove <br...> or anything after
    rawName = rawName.split("<")[0].trim();

    const stationName = rawName;
    console.log(`Processing station: ${stationName}`);

    const levels = [];

    // Find rows. Rows start with "|-"
    const rows = block.split("|-");

    for (const row of rows) {
        // Check for Level indicator
        const levelMatch = row.match(/^!(\d+)\s*$/m);
        if (levelMatch) {
            const levelNum = parseInt(levelMatch[1], 10);

            const cells = row.split(/\r?\n\|/);

            if (cells.length >= 2) {
                const reqsText = cells[1];

                const requirements = [];
                const lines = reqsText.split(/\r?\n/);

                for (const line of lines) {
                    const l = line.trim();
                    if (!l.startsWith("*")) continue;

                    const content = l.substring(1).trim();

                    // Item: "10 [[Item]]"
                    const itemMatch = content.match(/^([\d,]+)\s*\[\[(.*?)\]\]/);

                    // Trader: "[[Trader]] LL2"
                    const traderMatch = content.match(/^\[\[(.*?)\]\]\s*LL(\d+)/);

                    // Station: "Level 2 [[Hideout#Modules|Station]]"
                    const stationMatch = content.match(
                        /^Level\s*(\d+)\s*\[\[Hideout#Modules\|(.*?)\]\]/
                    );

                    // Skill: "[[Skill]] Level 1"
                    const skillMatch = content.match(
                        /^\[\[(?:Character skills#)?(.*?)\]\]\s*(?:Level\s*)?(\d+)/
                    );

                    const gameEditionMatch = content.match(/Owning "(.*?)" game edition/i);
                    const isFoundInRaid = content.includes("found [[Found in raid");

                    // Logic
                    if (stationMatch) {
                        requirements.push({
                            type: "station",
                            name: normalizeName(stationMatch[2]),
                            level: parseInt(stationMatch[1]),
                        });
                    } else if (traderMatch) {
                        requirements.push({
                            type: "trader",
                            name: normalizeName(traderMatch[1]),
                            level: parseInt(traderMatch[2]),
                        });
                    } else if (itemMatch) {
                        let name = itemMatch[2];
                        // Fix pipe issue (e.g. "FireKlean gun lube|#FireKlean gun lube")
                        if (name.includes("|")) {
                            name = name.split("|")[0];
                        }

                        let qty = parseNum(itemMatch[1]);

                        requirements.push({
                            type: "item",
                            name: normalizeName(name),
                            quantity: qty,
                            foundInRaid: isFoundInRaid,
                        });
                    } else if (gameEditionMatch) {
                        requirements.push({
                            type: "special",
                            description: `Own ${gameEditionMatch[1]} edition`,
                        });
                    } else if (skillMatch) {
                        if (!traderMatch && !stationMatch) {
                            requirements.push({
                                type: "skill",
                                name: normalizeName(skillMatch[1]),
                                level: parseInt(skillMatch[2]),
                            });
                        }
                    }
                }

                // Construction Time
                let constructionTime = "Instant";
                if (cells.length > 1) {
                    const potentialTime = cells[cells.length - 1].trim();
                    if (potentialTime.match(/\d+\s*(?:hour|min|sec)|Instant/i)) {
                        constructionTime = potentialTime.replace(/\|/, "").trim();
                    }
                }

                levels.push({
                    level: levelNum,
                    requirements,
                    constructionTime,
                });
            }
        }
    }

    if (levels.length > 0) {
        stations.push({
            name: stationName,
            normalizedName: normalizeName(stationName),
            levels,
        });
    }
}

fs.writeFileSync(outputFile, JSON.stringify(stations, null, 2));
console.log(`Parsed ${stations.length} stations to ${outputFile}`);
