import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import markdownLinkCheck from "markdown-link-check";

const root = fileURLToPath(new URL("../", import.meta.url));
const checkLinks = promisify(markdownLinkCheck);

async function markdownFiles(directory) {
    const entries = await readdir(path.join(root, directory), { withFileTypes: true });
    const files = await Promise.all(entries.map((entry) => {
        const relative = path.join(directory, entry.name);
        if (entry.isDirectory()) return markdownFiles(relative);
        return entry.name.endsWith(".md") ? [relative] : [];
    }));
    return files.flat().sort();
}

const files = [
    "README.md", "AGENTS.md", "CLAUDE.md", "db-scripts/README.md",
    ...await markdownFiles("docs"),
];
let checked = 0;
let failed = 0;
for (const file of files) {
    const absolute = path.join(root, file);
    const results = await checkLinks(await readFile(absolute, "utf8"), {
        baseUrl: pathToFileURL(`${path.dirname(absolute)}${path.sep}`).href,
        ignorePatterns: [{ pattern: /^(?:https?:|mailto:|\/\/)/i }],
    });
    for (const result of results) {
        if (result.status === "ignored") continue;
        checked += 1;
        if (result.status !== "alive") {
            failed += 1;
            console.error(`${file}: broken link ${result.link}`);
        }
    }
}
console.log(`Checked ${checked} local links in ${files.length} Markdown files; ${failed} broken.`);
if (failed) process.exitCode = 1;
