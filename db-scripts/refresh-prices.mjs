import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createJiti } from "jiti";
import { getTursoConfig, loadLocalEnv, parseModes } from "./lib/config.mjs";
import { createTursoClient } from "./lib/turso.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");

function parseArguments(argv) {
    const options = { modes: ["regular", "pve", "pvp-season"], concurrency: 12 };
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === "--modes") options.modes = parseModes(argv[++index]);
        else if (argument === "--concurrency") options.concurrency = Number(argv[++index]);
        else throw new Error(`Unknown argument: ${argument}`);
    }
    if (
        !Number.isInteger(options.concurrency) ||
        options.concurrency < 1 ||
        options.concurrency > 32
    ) {
        throw new Error("--concurrency must be an integer between 1 and 32");
    }
    return options;
}

async function main() {
    await loadLocalEnv(projectRoot);
    const options = parseArguments(process.argv.slice(2));
    const jiti = createJiti(pathToFileURL(import.meta.url).href, {
        alias: { "@": path.join(projectRoot, "src") },
    });
    const [{ refreshPriceMode }, { TursoPriceRefreshStore }, releaseConfig] =
        await Promise.all([
            jiti.import(path.join(projectRoot, "src/server/prices/refresh-prices.ts")),
            jiti.import(path.join(projectRoot, "src/server/prices/price-store.ts")),
            jiti.import(path.join(projectRoot, "src/server/db/release-config.ts")),
        ]);
    const client = createTursoClient(getTursoConfig());
    const store = new TursoPriceRefreshStore(client);
    try {
        for (const mode of options.modes) {
            process.stdout.write(`Refreshing ${mode} prices…\n`);
            const summary = await refreshPriceMode({
                mode,
                releaseId: releaseConfig.getActiveDataReleaseId(mode),
                store,
                concurrency: options.concurrency,
                onProgress(checked, eligible) {
                    if (checked % 300 === 0 || checked === eligible) {
                        process.stdout.write(`  ${mode}: ${checked}/${eligible}\n`);
                    }
                },
            });
            process.stdout.write(`${JSON.stringify(summary)}\n`);
        }
    } finally {
        client.close();
    }
}

main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
});
