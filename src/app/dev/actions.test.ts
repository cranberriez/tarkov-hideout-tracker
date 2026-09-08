import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { createRequire } from "node:module";
import { createJiti } from "jiti";

const require = createRequire(import.meta.url);
const jiti = createJiti(import.meta.url, {
	alias: {
		"@": path.join(process.cwd(), "src"),
		"server-only": path.join(path.dirname(require.resolve("server-only")), "empty.js"),
	},
});
const { changeRelease } = await jiti.import<typeof import("./actions")>("./actions.ts");

test("direct release-action calls reject every non-development environment before processing input", async () => {
	const previous = process.env.NODE_ENV;
	try {
		for (const environment of ["production", "test", "preview", undefined]) {
			if (environment === undefined) delete process.env.NODE_ENV;
			else Object.assign(process.env, { NODE_ENV: environment });
			for (const action of ["pin", "resume", "local", "clear-local"]) {
				const form = new FormData();
				form.set("mode", "regular");
				form.set("action", action);
				form.set("releaseId", "ready-release");
				let inputReads = 0;
				form.get = () => { inputReads++; throw new Error("Input must not be processed"); };
				await assert.rejects(changeRelease({ error: null }, form), (error: unknown) => {
					assert.equal((error as { digest?: string }).digest, "NEXT_HTTP_ERROR_FALLBACK;404");
					return true;
				});
				assert.equal(inputReads, 0, `${environment}/${action} must stop at the environment guard`);
			}
		}
		Object.assign(process.env, { NODE_ENV: "development" });
		assert.deepEqual(await changeRelease({ error: null }, new FormData()), { error: "Unsupported game mode" });
	} finally {
		if (previous === undefined) delete process.env.NODE_ENV;
		else Object.assign(process.env, { NODE_ENV: previous });
	}
});
