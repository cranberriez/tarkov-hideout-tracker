"use client";

import { useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Images } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { SEASONS } from "@/lib/cfg/seasons";
import { useCurrentSeason } from "./useCurrentSeason";

/** Hotlinked from Battlestate's X posts; nothing is self-hosted. A broken link hides its image. */
const BANNER = "https://pbs.twimg.com/media/HW6v7zGacAAosFO?format=jpg&name=large";
/**
 * Nikita's #untarcontrol posts, newest first. `media` holds pbs.twimg.com/media/<id> IDs in post order;
 * thumbnails use X's small size and the viewer opens the large one.
 */
const GALLERY: { status: string; media: string[] }[] = [
	{ status: "2123038600988352640", media: ["HXaMWcwbsAENzGt"] },
	{ status: "2122254255239360887", media: ["HXPC4HtbwAAvR9g", "HXPC_eRaEAAkENJ"] },
	{ status: "2121993247304343683", media: ["HXLVjEkbEAA82YI"] },
	{ status: "2121257071429795864", media: ["HXA394IakAAmqNT", "HXA4ACBbMAArDXV"] },
];
const twimg = (id: string, size: "small" | "large") => `https://pbs.twimg.com/media/${id}?format=jpg&name=${size}`;
const postUrl = (status: string) => `https://x.com/nikgeneburn/status/${status}`;

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
	const [open, setOpen] = useState<{ post: number; image: number } | null>(null);
	return (
		<>
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
					<div className="mt-auto grid grid-cols-4 gap-2 pt-1">
						{GALLERY.map((post, index) => (
							<button
								key={post.status}
								type="button"
								onClick={() => setOpen({ post: index, image: 0 })}
								aria-label={`Open UNTAR Control preview ${index + 1}`}
								className="group relative block aspect-[8/5] overflow-hidden rounded-md bg-untar-surface"
							>
								<RemoteImage
									src={twimg(post.media[0], "small")}
									alt={`UNTAR Control preview ${index + 1}`}
									className="size-full object-cover transition-transform group-hover:scale-105"
								/>
								{post.media.length > 1 && (
									<span className="absolute right-1 top-1 flex items-center gap-0.5 rounded-sm bg-untar-surface/80 px-1 text-[10px] font-semibold">
										<Images aria-hidden className="size-3" />
										{post.media.length}
									</span>
								)}
							</button>
						))}
					</div>
				</div>
				<RemoteImage
					src={BANNER}
					alt="UNTAR Control key art"
					className="size-full max-h-80 object-cover lg:max-h-none"
				/>
			</section>
			<GalleryViewer open={open} onChange={setOpen} />
		</>
	);
}

/** Large view of one gallery post; posts with several images page through them. */
function GalleryViewer({
	open,
	onChange,
}: {
	open: { post: number; image: number } | null;
	onChange: (next: { post: number; image: number } | null) => void;
}) {
	const post = open && GALLERY[open.post];
	const count = post?.media.length ?? 0;
	const step = (delta: number) => open && onChange({ ...open, image: (open.image + delta + count) % count });
	return (
		<Dialog open={Boolean(post)} onOpenChange={(next) => !next && onChange(null)}>
			<DialogContent
				aria-describedby={undefined}
				className="max-w-5xl overflow-hidden border-none bg-untar-surface p-0 text-untar-ink"
				onKeyDown={(event) => {
					if (count < 2) return;
					if (event.key === "ArrowRight") step(1);
					if (event.key === "ArrowLeft") step(-1);
				}}
			>
				<DialogTitle className="sr-only">UNTAR Control preview</DialogTitle>
				{post && open && (
					<>
						<RemoteImage
							key={post.media[open.image]}
							src={twimg(post.media[open.image], "large")}
							alt={`UNTAR Control preview ${open.post + 1}, image ${open.image + 1}`}
							className="max-h-[80vh] w-full object-contain"
						/>
						<div className="flex items-center gap-3 px-4 py-3 text-sm">
							{count > 1 && (
								<div className="flex items-center gap-1">
									<button
										type="button"
										onClick={() => step(-1)}
										aria-label="Previous image"
										className="rounded p-1 hover:bg-untar-ink/10"
									>
										<ChevronLeft className="size-4" />
									</button>
									<span className="tabular-nums text-untar-ink/70">
										{open.image + 1} / {count}
									</span>
									<button
										type="button"
										onClick={() => step(1)}
										aria-label="Next image"
										className="rounded p-1 hover:bg-untar-ink/10"
									>
										<ChevronRight className="size-4" />
									</button>
								</div>
							)}
							<a
								href={postUrl(post.status)}
								target="_blank"
								rel="noreferrer"
								className="ml-auto inline-flex items-center gap-1 text-untar-ink/80 hover:text-untar"
							>
								View on X
								<ArrowUpRight aria-hidden className="size-4" />
							</a>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
