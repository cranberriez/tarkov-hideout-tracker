import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, "src");

function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return sourceFiles(entryPath);
        return /\.(?:ts|tsx)$/.test(entry.name) ? [entryPath] : [];
    });
}

function moduleImports(source: string): string[] {
    const imports = new Set<string>();
    const staticImport = /\b(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
    const dynamicImport = /\bimport\(\s*["']([^"']+)["']\s*\)/g;

    for (const pattern of [staticImport, dynamicImport]) {
        for (const match of source.matchAll(pattern)) imports.add(match[1]);
    }

    return [...imports];
}

function relativePath(file: string): string {
    return path.relative(projectRoot, file).replaceAll("\\", "/");
}

test("normal application modules do not import concrete Tarkov data services", () => {
    const files = [
        ...sourceFiles(path.join(sourceRoot, "app")),
        ...sourceFiles(path.join(sourceRoot, "features")),
    ];
    const violations: string[] = [];

    for (const file of files) {
        const relative = relativePath(file);
        if (
            relative.startsWith("src/app/dev/") ||
            relative.startsWith("src/app/api/maps/") ||
            relative === "src/app/api/revalidate/route.ts"
        ) {
            continue;
        }

        const imports = moduleImports(readFileSync(file, "utf8"));
        if (imports.some((specifier) => specifier.startsWith("@/server/services/"))) {
            violations.push(relative);
        }
    }

    assert.deepEqual(violations, []);
});

test("client modules do not import server code", () => {
    const violations: string[] = [];

    for (const file of sourceFiles(sourceRoot)) {
        const source = readFileSync(file, "utf8");
        if (relativePath(file).startsWith("src/app/dev/")) continue;
        if (!/^\s*["']use client["'];/.test(source)) continue;
        if (moduleImports(source).some((specifier) => specifier.startsWith("@/server/"))) {
            violations.push(relativePath(file));
        }
    }

    assert.deepEqual(violations, []);
});

test("canonical types stay independent of UI, stores, and server implementations", () => {
    const forbiddenPrefixes = ["@/features/", "@/lib/stores/", "@/server/"];
    const violations: string[] = [];

    for (const file of sourceFiles(path.join(sourceRoot, "types"))) {
        const imports = moduleImports(readFileSync(file, "utf8"));
        if (
            imports.some(
                (specifier) =>
                    specifier === "react" ||
                    specifier.startsWith("react/") ||
                    forbiddenPrefixes.some((prefix) => specifier.startsWith(prefix)),
            )
        ) {
            violations.push(relativePath(file));
        }
    }

    assert.deepEqual(violations, []);
});

test("removed global data boundaries stay deleted", () => {
    const removedPaths = [
        "src/types/types.ts",
        "src/features/maps/map-types.ts",
        "src/lib/utils/quest-pooling.ts",
        "src/app/(data)/_dataContext.tsx",
        "src/server/services/tarkovData.ts",
    ];

    assert.deepEqual(
        removedPaths.filter((file) => existsSync(path.join(projectRoot, file))),
        [],
    );
});

test("pages enter Tarkov data through queries rather than the concrete repository", () => {
    const violations = sourceFiles(path.join(sourceRoot, "app"))
        .filter((file) => /(?:^|[\\/])page\.tsx$/.test(file))
        .filter((file) =>
            moduleImports(readFileSync(file, "utf8")).some(
                (specifier) =>
                    specifier === "@/server/repositories/tarkov-data/current-repository",
            ),
        )
        .map(relativePath);

    assert.deepEqual(violations, []);
});

test("queries do not bypass repositories by importing provider services", () => {
    const violations = sourceFiles(path.join(sourceRoot, "server", "queries"))
        .filter((file) =>
            moduleImports(readFileSync(file, "utf8")).some((specifier) =>
                specifier.startsWith("@/server/services/"),
            ),
        )
        .map(relativePath);

    assert.deepEqual(violations, []);
});

test("normal layouts do not inspect Redis infrastructure", () => {
    const violations = sourceFiles(path.join(sourceRoot, "app"))
        .filter((file) => /(?:^|[\\/])layout\.tsx$/.test(file))
        .filter((file) =>
            moduleImports(readFileSync(file, "utf8")).includes("@/server/redis"),
        )
        .map(relativePath);

    assert.deepEqual(violations, []);
});
