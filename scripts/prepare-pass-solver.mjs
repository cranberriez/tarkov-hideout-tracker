import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const source = dirname(fileURLToPath(import.meta.resolve("highs")));
const dest = "public/battle-pass/highs";
await mkdir(dest, { recursive: true });
for (const file of ["highs.mjs", "highs.wasm"]) await copyFile(join(source, file), join(dest, file));
await copyFile(join(source, "../LICENSE"), join(dest, "LICENSE"));
