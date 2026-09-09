import { QueryClient, type Query } from "@tanstack/react-query";
import { shouldRetryRequest } from "./request";

export const DEFAULT_QUERY_GC_TIME = 30 * 60 * 1000;
export const DEFAULT_INACTIVE_QUERY_LIMIT = 100;

function enforceInactiveLimits(client: QueryClient) {
	const groups = new Map<string, { limit: number; queries: Query[] }>();
	for (const query of client.getQueryCache().getAll()) {
		if (query.isActive() || query.state.fetchStatus !== "idle") continue;
		const group = query.meta?.retentionGroup;
		if (typeof group !== "string") continue;
		const limit = typeof query.meta?.inactiveQueryLimit === "number"
			? Math.max(0, Math.floor(query.meta.inactiveQueryLimit))
			: DEFAULT_INACTIVE_QUERY_LIMIT;
		const current = groups.get(group) ?? { limit, queries: [] };
		current.limit = Math.min(current.limit, limit);
		current.queries.push(query);
		groups.set(group, current);
	}
	for (const { limit, queries } of groups.values()) {
		queries
			.sort((left, right) => right.state.dataUpdatedAt - left.state.dataUpdatedAt)
			.slice(limit)
			.forEach((query) => client.getQueryCache().remove(query));
	}
}

export function createQueryClient(options: { gcTime?: number } = {}): QueryClient {
	const client = new QueryClient({
		defaultOptions: {
			queries: {
				gcTime: options.gcTime ?? DEFAULT_QUERY_GC_TIME,
				retry: shouldRetryRequest,
				refetchOnWindowFocus: false,
			},
		},
	});
	let queued = false;
	client.getQueryCache().subscribe(() => {
		if (queued) return;
		queued = true;
		queueMicrotask(() => {
			queued = false;
			enforceInactiveLimits(client);
		});
	});
	return client;
}

/** Server callers must create one client per request. */
export const makeQueryClient = createQueryClient;
