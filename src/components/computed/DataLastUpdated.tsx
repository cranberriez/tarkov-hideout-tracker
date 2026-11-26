import { formatUpdatedAt } from "@/lib/utils/format-time";
import { useMemo, useSyncExternalStore } from "react";

interface DataLastUpdatedProps {
	stationsUpdatedAt?: number | null;
	itemsUpdatedAt?: number | null;
}

const noSubscription = () => () => {};

/**
 * Timestamps format in the visitor's locale and time zone, which the server cannot know, so they render
 * after hydration (server HTML and the hydration pass show a placeholder) to keep cached pages consistent.
 */
export function DataLastUpdated({ stationsUpdatedAt = null, itemsUpdatedAt = null }: DataLastUpdatedProps) {
	const isClient = useSyncExternalStore(
		noSubscription,
		() => true,
		() => false,
	);
	const formatted = useMemo(
		() => ({
			stations: formatUpdatedAt(stationsUpdatedAt),
			items: formatUpdatedAt(itemsUpdatedAt),
		}),
		[stationsUpdatedAt, itemsUpdatedAt],
	);

	const hasAnyTimestamp = !!formatted.stations || !!formatted.items;
	const value = (text: string, timestamp: number | null) =>
		isClient && timestamp ? (
			<time dateTime={new Date(timestamp).toISOString()}>{text}</time>
		) : (
			<span aria-hidden="true" className="inline-block h-2 w-24 animate-pulse rounded-xs bg-muted-foreground/30" />
		);

	return (
		<div className="flex items-center mt-4 gap-2 text-xs text-subtle-foreground">
			{hasAnyTimestamp && (
				<div className="flex flex-wrap items-center justify-start gap-2">
					{formatted.stations && (
						<span className="px-2 py-1 rounded-full border border-border-color bg-shadow/30 text-[10px] font-mono uppercase tracking-wide">
							Hideout data · {value(formatted.stations, stationsUpdatedAt)}
						</span>
					)}
					{formatted.items && (
						<span className="px-2 py-1 rounded-full border border-border-color bg-shadow/30 text-[10px] font-mono uppercase tracking-wide">
							Item data · {value(formatted.items, itemsUpdatedAt)}
						</span>
					)}
				</div>
			)}
		</div>
	);
}
