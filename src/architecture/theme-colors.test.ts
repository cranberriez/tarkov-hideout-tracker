import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const exceptions = new Set([
    "src/app/globals.css",
    "src/components/core/RouteLoader.tsx",
    "src/components/core/RouteLoader.module.css",
    "src/lib/cfg/profile-colors.ts",
]);

function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) return sourceFiles(file);
        return /\.(?:tsx?|css)$/.test(entry.name) && !entry.name.includes(".test.") ? [file] : [];
    });
}

test("application colors use documented theme roles instead of local palettes", () => {
    const violations: string[] = [];
    const patterns = [
        /#[\da-f]{3,8}\b/gi,
        /\b(?:rgb|rgba|hsl|hsla|oklch|oklab|hwb|lab|lch)\(/g,
        /\b(?:text|bg|border|ring(?:-offset)?|fill|stroke|from|via|to|shadow|divide|outline|accent|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+/g,
        /\b(?:text|bg|border|ring(?:-offset)?|fill|stroke|from|via|to|shadow|divide|outline|accent|decoration)-(?:white|black)\b/g,
    ];
    for (const file of sourceFiles(path.join(root, "src"))) {
        const relative = path.relative(root, file).replaceAll("\\", "/");
        if (exceptions.has(relative)) continue;
        readFileSync(file, "utf8").split("\n").forEach((line, index) => {
            for (const pattern of patterns) {
                for (const match of line.matchAll(pattern)) violations.push(`${relative}:${index + 1}: ${match[0]}`);
            }
        });
    }
    assert.deepEqual(violations, [], `Document a semantic color in globals.css before use:\n${violations.join("\n")}`);
});

test("theme color references resolve and success stays independent of brand", () => {
    const css = readFileSync(path.join(root, "src/app/globals.css"), "utf8");
    const definitions = new Map([...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2]]));
    for (const match of css.matchAll(/var\((--[\w-]+)\)/g)) {
        assert.ok(definitions.has(match[1]), `Undefined theme reference ${match[1]}`);
    }
    const success = definitions.get("--success");
    assert.ok(success);
    assert.doesNotMatch(success, /brand|accent/);
    assert.ok(definitions.has("--accent-alternate"));
});
