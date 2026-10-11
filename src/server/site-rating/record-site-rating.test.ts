import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { createJiti } from "jiti";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { feedback, postgresSchema } from "../postgres/schema";
import { RETRY_DELAY_MS, type SiteRatingValue } from "../../features/site-rating/rating-model";
import { runRatingSubmission } from "./submission";

const require = createRequire(import.meta.url);
const jiti = createJiti(import.meta.url, {
	alias: {
		"@": path.join(process.cwd(), "src"),
		"server-only": path.join(path.dirname(require.resolve("server-only")), "empty.js"),
	},
});
const { recordSiteRating } = await jiti.import<typeof import("./record-site-rating")>("./record-site-rating.ts");
const { postgresFixture } = require("../../../db-scripts/lib/test-postgres.mjs") as {
	postgresFixture: () => Promise<{ pool: Pool; close: () => Promise<void> }>;
};
const hasDisposablePostgres = Boolean(process.env.TEST_DATABASE_URL);

test("invalid ratings are rejected before querying storage", async () => {
	const pool = {
		query() {
			assert.fail("Invalid input must not query storage");
		},
	} as unknown as Pick<Pool, "query">;
	for (const invalid of ["", "GOOD", null, 1]) {
		await assert.rejects(recordSiteRating(invalid as SiteRatingValue, pool), /Invalid site rating/);
	}
});

test("recorder propagates database failure into the submission retry", async (t) => {
	t.mock.method(console, "error", () => {});
	const failure = new Error("Database unavailable");
	const pool = {
		query: async () => {
			throw failure;
		},
	} as unknown as Pick<Pool, "query">;
	await assert.rejects(recordSiteRating("good", pool), (error) => error === failure);
	assert.deepEqual(
		await runRatingSubmission(
			"bad",
			(rating) => recordSiteRating(rating, pool),
			() => 100,
		),
		{
			success: false,
			cookieValues: { submitted: "false", reshowAt: String(100 + RETRY_DELAY_MS) },
		},
	);
});

test(
	"PostgreSQL feedback seeds one row and preserves concurrent increments and aggregate timestamps",
	{
		skip: !hasDisposablePostgres,
	},
	async () => {
		const fixture = await postgresFixture();
		const db = drizzle(fixture.pool, { schema: postgresSchema });
		try {
			const [initial] = await db.select().from(feedback);
			assert.equal(initial.id, 1);
			assert.equal(initial.good, BigInt(0));
			assert.equal(initial.bad, BigInt(0));
			await fixture.pool.query("UPDATE feedback SET updated_at = '2000-01-01'::timestamptz");
			await recordSiteRating("good", fixture.pool);
			const [good] = await db.select().from(feedback);
			assert.equal(good.good, BigInt(1));
			assert.equal(good.bad, BigInt(0));
			assert.equal(good.createdAt.getTime(), initial.createdAt.getTime());
			assert.ok(good.updatedAt.getTime() > Date.UTC(2000, 0, 1));
			await recordSiteRating("bad", fixture.pool);
			const votes = Array.from({ length: 60 }, (_, index) => (index % 3 === 0 ? "bad" : ("good" as const)));
			await Promise.all(votes.map((rating) => recordSiteRating(rating, fixture.pool)));
			const rows = await db.select().from(feedback);
			assert.equal(rows.length, 1);
			assert.equal(rows[0].good, BigInt(41));
			assert.equal(rows[0].bad, BigInt(21));
			assert.equal(rows[0].createdAt.getTime(), initial.createdAt.getTime());
			assert.ok(rows[0].updatedAt.getTime() >= good.updatedAt.getTime());

			// A missing singleton is also safe when the first submissions arrive together.
			await fixture.pool.query("DELETE FROM feedback");
			await Promise.all(votes.map((rating) => recordSiteRating(rating, fixture.pool)));
			const [recreated] = await db.select().from(feedback);
			assert.equal(recreated.good, BigInt(40));
			assert.equal(recreated.bad, BigInt(20));
			await fixture.pool.query("UPDATE feedback SET good = 9007199254740992");
			await recordSiteRating("good", fixture.pool);
			assert.equal((await db.select().from(feedback))[0].good, BigInt("9007199254740993"));
		} finally {
			await fixture.close();
		}
	},
);

test(
	"PostgreSQL feedback enforces singleton and nonnegative counters and reports failed writes",
	{
		skip: !hasDisposablePostgres,
	},
	async (t) => {
		t.mock.method(console, "error", () => {});
		const fixture = await postgresFixture();
		try {
			for (const statement of [
				"INSERT INTO feedback (id) VALUES (2)",
				"INSERT INTO feedback (id) VALUES (1)",
				"UPDATE feedback SET good = -1",
				"UPDATE feedback SET bad = -1",
				"UPDATE feedback SET good = NULL",
				"UPDATE feedback SET bad = NULL",
			]) {
				await assert.rejects(fixture.pool.query(statement));
			}
			assert.deepEqual((await fixture.pool.query("SELECT good, bad FROM feedback")).rows, [{ good: "0", bad: "0" }]);
			await fixture.pool.query("DROP TABLE feedback");
			const result = await runRatingSubmission(
				"good",
				(rating) => recordSiteRating(rating, fixture.pool),
				() => 100,
			);
			assert.equal(result.success, false);
			assert.equal(result.cookieValues.submitted, "false");
			assert.equal(result.cookieValues.reshowAt, String(100 + RETRY_DELAY_MS));
		} finally {
			await fixture.close();
		}
	},
);
