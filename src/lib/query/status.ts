import { queryOptions } from "@tanstack/react-query";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import type { DataStatusPayload } from "@/types/contracts";
import { fetchJson, ResponseValidationError } from "./request";

export const DATA_STATUS_STALE_TIME = 5 * 60 * 1000;

export function validateDataStatusPayload(value: unknown, expectedMode: TarkovJsonGameMode): DataStatusPayload {
	if (!value || typeof value !== "object") throw new ResponseValidationError("Data status response is not an object", value);
	const payload = value as Partial<DataStatusPayload>;
	if (payload.mode !== expectedMode || typeof payload.releaseId !== "string" || payload.releaseId.length === 0) {
		throw new ResponseValidationError("Data status response has an invalid release identity", value);
	}
	for (const domain of ["stations", "items", "quests", "crafts", "barters"] as const) {
		const entry = payload[domain];
		if (!entry || typeof entry.available !== "boolean" || !(entry.updatedAt === null || typeof entry.updatedAt === "number") || !(entry.error === null || typeof entry.error === "string") || !(entry.diagnostics === null || typeof entry.diagnostics === "object")) {
			throw new ResponseValidationError(`Data status response has an invalid ${domain} status`, value);
		}
	}
	if (!payload.prices || !(payload.prices.changedAt === null || typeof payload.prices.changedAt === "number") || !(payload.prices.checkedAt === null || typeof payload.prices.checkedAt === "number") || !(payload.prices.error === null || typeof payload.prices.error === "string")) {
		throw new ResponseValidationError("Data status response has an invalid prices status", value);
	}
	return payload as DataStatusPayload;
}

export function dataStatusQueryOptions(mode: TarkovJsonGameMode) {
	return queryOptions({
		queryKey: ["data-status", mode] as const,
		queryFn: async ({ signal }) => validateDataStatusPayload(
			await fetchJson<unknown>(`/api/data/status?mode=${encodeURIComponent(mode)}`, { signal }),
			mode,
		),
		staleTime: DATA_STATUS_STALE_TIME,
	});
}
