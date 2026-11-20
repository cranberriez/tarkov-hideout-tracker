"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { SEASONS } from "@/lib/cfg/seasons";
import { useCurrentSeason } from "./useCurrentSeason";

/** Hotlinked from Battlestate's X posts; nothing is self-hosted. A broken link hides its image. */
const BANNER = "https://pbs.twimg.com/media/HW6v7zGacAAosFO?format=jpg&name=large";
/** Media IDs from pbs.twimg.com/media/<id>; thumbnails use X's small size, links open the original. */
const GALLERY = ["HXaMWcwbsAENzGt", "HXLVjEkbEAA82YI"];
const twimg = (id: string, size: "small" | "4096x4096") => `https://pbs.twimg.com/media/${id}?format=jpg&name=${size}`;

const STATEMENT =
	"Uncover the truth behind the UN mission in Tarkov - where diplomatic mandates conceal private agendas, alliances are built on silence, and every intervention comes at a price. Trace the decisions that led to the crisis, and discover who stands to gain from its aftermath. Everything is connected. The official record tells one story. What it leaves out tells another.";

export function RemoteImage({ src, alt, className }: { src: string; alt: string; className: string }) {
	const [failed, setFailed] = useState(false);
	if (failed) return null;
	return (
		// eslint-disable-next-line @next/next/no-img-element -- hotlinked on purpose; no optimizer copies
		<img
			src={src}
			alt={alt}
			className={className}
			loading="lazy"
			decoding="async"
			referrerPolicy="no-referrer"
			onError={() => setFailed(true)}
		/>
	);
}

/** Season 2 page hero: shows the KORD end date until Season 2 is current. */
export function SeasonTwoTeaser() {
	const upcoming = useCurrentSeason().id === "season-1";
	const status = upcoming
		? `KORD ends ${new Date(SEASONS[0].endsAt).toLocaleString("en-US", {
				timeZone: "America/Los_Angeles",
				weekday: "short",
				month: "short",
				day: "numeric",
				hour: "numeric",
				minute: "2-digit",
				timeZoneName: "short",
			})}`
		: "Now live";
	return (
		<section
			aria-labelledby="untar-control-heading"
			className="grid overflow-hidden rounded-xl bg-untar-surface text-untar-ink lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
		>
			<div className="flex flex-col gap-3 p-5">
				<div className="flex flex-wrap items-center gap-2">
					<span className="rounded-sm bg-untar px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-untar-surface">
						Season 2
					</span>
					<span className="text-xs text-untar-ink/70">{status}</span>
				</div>
				<h1 id="untar-control-heading" className="text-3xl font-black uppercase leading-none tracking-wide">
					Untar <span className="text-untar">Control</span>
				</h1>
				<blockquote className="space-y-1 text-sm leading-6 text-untar-ink/85">
					<p>{STATEMENT}</p>
					<footer className="text-xs text-untar-ink/60">— Nikita Buyanov</footer>
				</blockquote>
				<div className="mt-auto flex gap-2 pt-1">
					{GALLERY.map((id, index) => (
						<a
							key={id}
							href={twimg(id, "4096x4096")}
							target="_blank"
							rel="noreferrer"
							className="group relative block h-20 w-32 overflow-hidden rounded-md bg-untar-surface"
						>
							<RemoteImage
								src={twimg(id, "small")}
								alt={`UNTAR Control preview ${index + 1}`}
								className="size-full object-cover transition-transform group-hover:scale-105"
							/>
							<ArrowUpRight
								aria-hidden
								className="absolute right-1 top-1 size-4 opacity-0 drop-shadow transition-opacity group-hover:opacity-100"
							/>
						</a>
					))}
				</div>
			</div>
			<RemoteImage src={BANNER} alt="UNTAR Control key art" className="size-full max-h-80 object-cover lg:max-h-none" />
		</section>
	);
}
