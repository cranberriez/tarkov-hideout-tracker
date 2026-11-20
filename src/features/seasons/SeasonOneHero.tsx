"use client";

import { SEASONS } from "@/lib/cfg/seasons";
import { RemoteImage } from "./SeasonTwoTeaser";
import { useCurrentSeason } from "./useCurrentSeason";

/** Hotlinked from Battlestate's X post; nothing is self-hosted. */
const BANNER = "https://pbs.twimg.com/media/HK187nMaEAAnX_0?format=jpg&name=medium";

const date = (value: number) =>
	new Date(value).toLocaleString("en-US", {
		timeZone: "America/Los_Angeles",
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZoneName: "short",
	});

/** Season 1 page hero: live until KORD's configured end, then ended. */
export function SeasonOneHero() {
	const live = useCurrentSeason().id === "season-1";
	const endsAt = SEASONS[0].endsAt;
	return (
		<section
			aria-labelledby="kord-breach-heading"
			className="grid overflow-hidden rounded-xl bg-kord-surface text-untar-ink lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
		>
			<div className="flex flex-col justify-start gap-3 self-start p-5">
				<div className="flex flex-wrap items-center gap-2">
					<span className="rounded-sm bg-kord px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-kord-surface">
						Season 1
					</span>
					<span className="text-xs text-untar-ink/70">
						Started Aug 3, 2026 · {live ? "Ends" : "Ended"} {date(endsAt)}
					</span>
				</div>
				<h1 id="kord-breach-heading" className="text-3xl font-black uppercase leading-none tracking-[0.18em]">
					Kord <span className="text-kord">Breach</span>
				</h1>
				<p className="text-sm leading-6 text-untar-ink/85">
					The first seasonal wipe: every global modifier, the personal positives and negatives with their point values,
					and the most picked modifiers Battlestate published.
				</p>
			</div>
			<RemoteImage src={BANNER} alt="KORD Breach key art" className="size-full max-h-80 object-cover lg:max-h-none" />
		</section>
	);
}
