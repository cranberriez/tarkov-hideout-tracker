import { getPostgresPool } from "../postgres/connection";
import { applyCatalogUpdate, readCatalogBaseline } from "../../../db-scripts/lib/postgres-catalog.mjs";
import { prepareCatalog } from "./preparation.mjs";
import * as services from "./services";

export async function refreshCatalog() {
	const pool = getPostgresPool();
	const baseline = await readCatalogBaseline(pool);
	const modesData = await prepareCatalog(services);
	// The shared writer validates all modes before its atomic transaction and
	// rejects a stale baseline if another updater committed during preparation.
	return applyCatalogUpdate(pool, modesData, Date.now(), { baseline });
}
