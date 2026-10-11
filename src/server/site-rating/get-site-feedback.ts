import "server-only";
import { eq } from "drizzle-orm";
import { getPostgresDb } from "@/server/postgres/connection";
import { feedback } from "@/server/postgres/schema";

/** Read current site-wide totals without caching or creating a missing singleton. */
export async function getSiteFeedback(): Promise<{ good: string; bad: string } | null> {
	const [row] = await getPostgresDb()
		.select({ good: feedback.good, bad: feedback.bad })
		.from(feedback)
		.where(eq(feedback.id, 1))
		.limit(1);
	return row ? { good: row.good.toString(), bad: row.bad.toString() } : null;
}
