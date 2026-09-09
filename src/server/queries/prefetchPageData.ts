import { dehydrate, type QueryKey } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/query/client";
import { PartialDataError } from "@/lib/query/request";

export async function prefetchPageData<T>(
    queryKey: QueryKey,
    staleTime: number,
    load: () => Promise<T>,
    isComplete: (data: T) => boolean,
) {
    const client = createQueryClient({ gcTime: Infinity });
    let initialData: T | null = null;
    let loaded = false;
    await client.prefetchQuery({
        queryKey,
        staleTime,
        retry: false,
        queryFn: async () => {
            initialData = await load();
            loaded = true;
            if (!isComplete(initialData)) throw new PartialDataError("Some page data is unavailable.", initialData);
            return initialData;
        },
    });
    const state = dehydrate(client);
    client.clear();
    return { state, fallbackData: loaded && initialData !== null && !isComplete(initialData) ? initialData : null };
}
