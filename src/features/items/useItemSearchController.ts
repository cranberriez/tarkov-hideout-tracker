"use client";

import { useMemo } from "react";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { useSearchManifest } from "@/lib/search/useSearchManifest";
import { searchManifestItems } from "@/lib/search/manifest";

export function useItemSearchController({
	enabled,
	mode,
	query,
	resultLimit,
}: {
	enabled: boolean;
	mode: TarkovJsonGameMode;
	query: string;
	resultLimit: number;
}) {
	const result = useSearchManifest(mode, enabled);
	const hasSearchIntent = enabled && !!query.trim();
	const items = useMemo(
		() => (hasSearchIntent && result.data ? searchManifestItems(result.data.itemIndex, query, resultLimit) : []),
		[hasSearchIntent, result.data, query, resultLimit],
	);
	return {
		items,
		isLoading: hasSearchIntent && !result.data && !result.error,
		error: result.error?.message ?? null,
		retry: result.retry,
		hasNoResults: hasSearchIntent && !!result.data && items.length === 0,
	};
}
