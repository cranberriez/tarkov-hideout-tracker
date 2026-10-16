"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowUpRight, FileText, Map, Trophy } from "lucide-react";
import { Artwork } from "@/features/battle-pass/components/ui/Artwork";
import { BattlePassSeason, useBattlePassData } from "@/features/battle-pass/BattlePassSeason";
import { DOCUMENT_MAPS_HREF } from "@/lib/cfg/map-explorer";
import { getSeason, type SeasonId } from "@/lib/cfg/seasons";
import { battlePassPageHref } from "@/features/battle-pass/lib/battle-pass-page-link";
import { useBattlePass } from "@/features/battle-pass/useBattlePass";
import { useBattlePassPreferences } from "@/features/battle-pass/useBattlePassPreferences";
import { useUserStore } from "@/lib/stores/useUserStore";
import { estimatedDaysRemaining, seasonOverview } from "./season-overview-model";

const linkStyle =
	"inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand";

function ProgressBar({ value, label }: { value: number; label: string }) {
	const percent = Math.max(0, Math.min(100, Math.floor(value * 100)));
	return (
		<div
			role="progressbar"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={percent}
			className="h-1 overflow-hidden bg-highlight/10"
		>
			<div className="h-full bg-success" style={{ width: `${percent}%` }} />
		</div>
	);
}

export function SeasonOverviewPage({ seasonId = "season-1" }: { seasonId?: SeasonId }) {
	return (
		<BattlePassSeason seasonId={seasonId} showHeader={false} showNotice>
			<SeasonOverviewContent />
		</BattlePassSeason>
	);
}
function SeasonOverviewContent() {
	const { documents, pages, documentKeys, seasonId } = useBattlePassData();
	const season = getSeason(seasonId);
	const [progress] = useBattlePass();
	const [{ useClassified }] = useBattlePassPreferences();
	const gameMode = useUserStore((state) => state.gameMode);
	const [now, setNow] = useState<number | null>(null);
	useEffect(() => {
		const sync = () => setNow(Date.now());
		sync();
		const timer = setInterval(sync, 60_000);
		return () => clearInterval(timer);
	}, []);
	const overview = useMemo(
		() => seasonOverview(progress, useClassified, pages, documentKeys),
		[progress, useClassified, pages, documentKeys],
	);
	const covered = overview.coverage.ownedUsed + overview.coverage.classifiedUsed;
	const days = now === null || season.endsAt === null ? null : estimatedDaysRemaining(now, season.endsAt);
	const lastDay = new Date(season.endsAt ?? 0).toISOString().slice(0, 10);
	const ended = season.endsAt !== null && now !== null && new Date(now).toISOString().slice(0, 10) > lastDay;
	const endDate = new Date(season.endsAt ?? 0).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	});
	const needed: { doc: { key: string; name: string; img?: string }; amount: number }[] = documents
		.map((doc) => ({ doc, amount: overview.coverage.rows.find((row) => row.key === doc.key)?.missing ?? 0 }))
		.filter(({ amount }) => amount > 0);
	if (overview.coverage.classifiedMissing > 0)
		needed.push({
			doc: { key: "classified", name: "Classified documents" },
			amount: overview.coverage.classifiedMissing,
		});

	return (
		<main className="container mx-auto px-3 py-6 sm:px-6 sm:py-8">
			<header className="mb-6 flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-lg font-semibold">{season.title}</h1>
				<div className="flex flex-wrap gap-5">
					<Link href={"/battle-pass?season=" + seasonId} className={linkStyle}>
						<Trophy size={16} />
						Battle Pass
					</Link>
					<Link href={DOCUMENT_MAPS_HREF} className={linkStyle}>
						<Map size={16} />
						Docs Maps
					</Link>
				</div>
			</header>
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				<section
					aria-label="Estimated season countdown"
					style={{ "--profile-color": season.color } as CSSProperties}
					className="flex min-h-44 flex-col justify-between bg-[color-mix(in_oklab,var(--profile-color)_50%,var(--muted-foreground))] p-6 text-[var(--map-marker-ink)] sm:col-span-2 lg:col-span-1"
				>
					<h2 className="text-xs font-bold uppercase tracking-[0.2em]">{season.name}</h2>
					{season.endsAt === null ? (
						<p className="my-3 text-3xl font-bold">Test season</p>
					) : days === 0 ? (
						<p className="my-3 text-3xl font-bold">{ended ? "Season ended" : "Final day"}</p>
					) : (
						<p className="my-3 flex items-baseline gap-3">
							<span className="text-6xl font-bold tracking-tight tabular-nums">{days ?? "—"}</span>
							<span className="text-lg font-medium">days left</span>
						</p>
					)}
					<p className="text-xs font-medium">
						{season.endsAt === null ? "End date not announced" : "Est. ends " + endDate}
					</p>
				</section>
				<section className="flex min-w-0 flex-col justify-center bg-card p-6" aria-labelledby="completion-title">
					<h2 id="completion-title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Rewards completed
					</h2>
					<p className="mb-5 mt-3 text-4xl font-semibold tabular-nums">
						{overview.completed}
						<span className="ml-2 text-lg font-normal text-muted-foreground">/ {overview.totalRewards}</span>
					</p>
					<ProgressBar value={overview.completed / overview.totalRewards} label="Completed battle pass rewards" />
				</section>
				<section className="flex min-w-0 flex-col justify-center bg-card p-6" aria-labelledby="coverage-title">
					<h2 id="coverage-title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Goal documents covered
					</h2>
					{overview.plan.total > 0 ? (
						<>
							<p className="mb-5 mt-3 text-4xl font-semibold tabular-nums">
								{covered}
								<span className="ml-2 text-lg font-normal text-muted-foreground">/ {overview.plan.total}</span>
							</p>
							<ProgressBar value={covered / overview.plan.total} label="Goal plan document coverage" />
						</>
					) : (
						<p className="mt-3 text-sm text-muted-foreground">
							{overview.goals.length ? "Goals complete" : "No goals selected"}
						</p>
					)}
				</section>
			</div>
			<section className="mt-9" aria-labelledby="goals-title">
				<div className="mb-4 flex items-center justify-between gap-3">
					<h2 id="goals-title" className="text-lg font-semibold">
						Your reward goals
					</h2>
					<Link href={"/battle-pass?season=" + seasonId} className={linkStyle}>
						Edit goals
						<ArrowUpRight size={15} />
					</Link>
				</div>
				{overview.goals.length ? (
					<ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
						{overview.goals.map(({ tile, page, completed, fraction }) => (
							<li key={tile.id} className="min-w-0">
								<Link
									href={battlePassPageHref(page, seasonId)}
									className="group flex h-full flex-col bg-card transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
								>
									<div className="flex h-40 items-center justify-center bg-shadow/15 p-3 sm:h-48">
										<Artwork
											src={tile.bigImg || tile.img}
											sizes="(min-width: 1280px) 260px, (min-width: 768px) 30vw, 45vw"
											className="h-full w-full transition-transform group-hover:scale-105 motion-reduce:transform-none"
										/>
									</div>
									<div className="flex flex-1 flex-col p-4">
										<h3 className="text-sm font-semibold leading-snug">{tile.displayName}</h3>
										<p className="mb-4 mt-2 text-xs text-muted-foreground">
											Page {page}
											<ArrowUpRight size={12} className="ml-1 inline" />
										</p>
										<div className="mt-auto">
											<p className="mb-2 text-xs tabular-nums text-success">
												{completed ? "Completed" : `${Math.floor(fraction * 100)}% est.`}
											</p>
											<ProgressBar value={fraction} label={`${tile.displayName} estimated reward coverage`} />
										</div>
									</div>
								</Link>
							</li>
						))}
					</ul>
				) : (
					<div className="flex flex-wrap items-center justify-between gap-4 bg-card p-6">
						<p className="text-sm text-muted-foreground">Pick the rewards you want to work toward.</p>
						<Link href={"/battle-pass?season=" + seasonId} className={linkStyle}>
							Choose reward goals
							<ArrowUpRight size={16} />
						</Link>
					</div>
				)}
				{overview.plan.unresolvedIds.length > 0 && (
					<p role="status" className="mt-4 break-words text-xs text-warning">
						Unknown saved goal IDs: {overview.plan.unresolvedIds.join(", ")}. Excluded from estimates.
					</p>
				)}
			</section>
			{overview.plan.total > 0 && (
				<section className="mt-9" aria-labelledby="documents-title">
					<div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
						<h2 id="documents-title" className="text-lg font-semibold">
							Documents to collect
						</h2>
						<p className="text-sm tabular-nums text-muted-foreground">{overview.coverage.missing} remaining</p>
					</div>
					{needed.length ? (
						<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{needed.map(({ doc, amount }) => (
								<li key={doc.key} className="flex items-center gap-3 bg-card p-4">
									{doc.img ? (
										<Artwork src={doc.img} sizes="56px" className="h-14 w-14 shrink-0" />
									) : (
										<FileText aria-hidden className="h-14 w-14 shrink-0 text-muted-foreground" />
									)}
									<span className="min-w-0 flex-1 text-sm">{doc.name}</span>
									<span className="text-2xl font-semibold tabular-nums">{amount}</span>
								</li>
							))}
						</ul>
					) : (
						<p className="text-sm text-success">All documents for your current goal plan are covered.</p>
					)}
				</section>
			)}
			<details className="mt-9 text-sm text-muted-foreground">
				<summary className="w-fit cursor-pointer py-2 font-medium text-foreground focus-visible:outline-2 focus-visible:outline-brand">
					About this season
				</summary>
				<div className="mt-3 max-w-3xl space-y-3 leading-relaxed">
					<p>
						KORD Breach began August 3, 2026, introducing a seasonal KORD questline and Black Division encounters.
						Collect documents in raids and exchange them for free battle pass rewards. Pass progress is shared across
						PVP, PVE and KORD.
					</p>
					<p>
						Reward estimates allocate your documents once across goals and prerequisites, in page and reward order.
						Locked pages need fully covered prerequisites. Ordinary stock comes from your {gameMode} inventory;
						account-wide classified stock is {useClassified ? "included" : "excluded"} by your Battle Pass preference.
						Estimates do not record completion or spend documents.
					</p>
					<p>
						Classified documents can be used across modes and retained through character resets and future seasons. The
						countdown uses UTC calendar days and an estimated end date that may change.
					</p>
					<p className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
						<a
							href="https://steamcommunity.com/app/3932890/allnews/?l=english"
							target="_blank"
							rel="noopener noreferrer"
							className={linkStyle}
						>
							Official season update
						</a>
						<a
							href="https://t.me/escapefromtarkovEN/6795"
							target="_blank"
							rel="noopener noreferrer"
							className={linkStyle}
						>
							Classified documents
						</a>
					</p>
				</div>
			</details>
		</main>
	);
}
