import Link from "next/link";
import { SEASONS, type SeasonId } from "@/lib/cfg/seasons";
import { cn } from "@/lib/utils";

/** Switches between the static season pages. */
export function SeasonPageNav({ current }: { current: SeasonId }) {
	return (
		<nav aria-label="Seasons" className="flex flex-wrap gap-2">
			{SEASONS.map((season, index) => (
				<Link
					key={season.id}
					href={`/${season.id}`}
					aria-current={season.id === current ? "page" : undefined}
					className={cn(
						"rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
						season.id === current
							? "bg-surface-raised text-foreground"
							: "bg-card text-muted-foreground hover:text-foreground",
					)}
				>
					S{index + 1} {season.title.replace(/^Season \d+ /, "")}
				</Link>
			))}
		</nav>
	);
}
