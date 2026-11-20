"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getLastSitePath } from "@/components/core/HideOnSeasonPages";
import { SEASONS, type SeasonId } from "@/lib/cfg/seasons";
import { cn } from "@/lib/utils";

/**
 * Top row for the data-less season pages (they skip the app navbar): a link to the full tracker,
 * a Back button when the visitor came from elsewhere on the site, and the season switcher.
 */
const noSubscription = () => () => {};
/** True when the visitor arrived from a non-season page on this site (client navigation or full load). */
function cameFromSite() {
	if (getLastSitePath()) return true;
	try {
		const from = document.referrer ? new URL(document.referrer) : null;
		return !!from && from.origin === location.origin && !/^\/season-\d+/.test(from.pathname);
	} catch {
		return false;
	}
}

export function SeasonPageNav({ current }: { current: SeasonId }) {
	const canGoBack = useSyncExternalStore(noSubscription, cameFromSite, () => false);
	return (
		<header className="flex flex-wrap items-center justify-between gap-3">
			<div className="flex items-center gap-2">
				{canGoBack && (
					<button
						type="button"
						onClick={() => history.back()}
						className="inline-flex items-center gap-1.5 rounded-md bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground/85 transition-colors hover:text-foreground"
					>
						<ArrowLeft aria-hidden className="size-3.5" />
						Back
					</button>
				)}
				<Link href="/" className="group flex items-center gap-2 rounded-md px-1.5 py-1">
					<span className="relative size-6 shrink-0 group-hover:animate-spin">
						<Image src="/images/hideout/Hideout_icon.webp" alt="" fill sizes="24px" className="object-contain" />
					</span>
					<span className="text-sm font-bold tracking-wide">TARKOV HIDEOUT</span>
				</Link>
			</div>
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
								: "bg-card text-foreground/85 hover:text-foreground",
						)}
					>
						S{index + 1} {season.title.replace(/^Season \d+ /, "")}
					</Link>
				))}
			</nav>
		</header>
	);
}
