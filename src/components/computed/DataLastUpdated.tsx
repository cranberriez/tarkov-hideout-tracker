import { formatUpdatedAt } from "@/lib/utils/format-time";
import { useDataStore } from "@/lib/stores/useDataStore";
import { useMemo } from "react";

export function DataLastUpdated() {
	const stationsUpdatedAt = useDataStore((state) => state.stationsUpdatedAt);
	const itemsUpdatedAt = useDataStore((state) => state.itemsUpdatedAt);

	const formatted = useMemo(
		() => ({
			stations: formatUpdatedAt(stationsUpdatedAt),
			items: formatUpdatedAt(itemsUpdatedAt),
		}),
		[stationsUpdatedAt, itemsUpdatedAt]
	);

	const hasAnyTimestamp = !!formatted.stations || !!formatted.items;

	return (
		<div className="flex items-center mt-4 gap-2 text-xs text-gray-500">
			{hasAnyTimestamp && (
				<div className="flex flex-wrap items-center justify-start gap-2">
					{formatted.stations && (
						<span className="px-2 py-1 rounded-full border border-border-color bg-black/30 text-[10px] font-mono uppercase tracking-wide">
							Hideout data · {formatted.stations}
						</span>
					)}
					{formatted.items && (
						<span className="px-2 py-1 rounded-full border border-border-color bg-black/30 text-[10px] font-mono uppercase tracking-wide">
							Item data · {formatted.items}
						</span>
					)}
				</div>
			)}
		</div>
	);
}
