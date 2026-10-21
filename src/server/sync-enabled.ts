import "server-only";
import { isDev } from "@/lib/is-dev";

/** Keep unfinished companion tooling opt-in outside development. */
export function isSyncEnabled(): boolean {
	return isDev || process.env.syncEnabled === "true";
}
