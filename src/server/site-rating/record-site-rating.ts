import "server-only";
import type { Pool } from "pg";
import { isRating, type SiteRatingValue } from "@/features/site-rating/rating-model";
import { getPostgresPool } from "@/server/postgres/connection";

export async function recordSiteRating(rating: SiteRatingValue, pool?: Pick<Pool, "query">): Promise<void> {
	if (!isRating(rating)) throw new Error("Invalid site rating");
	// PostgreSQL locks the singleton conflict row and increments its current totals.
	// Recreate it if absent without a separate read or a lost-update race.
	await (pool ?? getPostgresPool()).query(
		`INSERT INTO feedback (id, good, bad) VALUES (1, $1, $2)
		 ON CONFLICT (id) DO UPDATE SET
		 good = feedback.good + EXCLUDED.good,
		 bad = feedback.bad + EXCLUDED.bad,
		 updated_at = clock_timestamp()`,
		[rating === "good" ? 1 : 0, rating === "bad" ? 1 : 0],
	);
}
