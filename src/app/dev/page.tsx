import Link from "next/link";
import { notFound } from "next/navigation";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { getReleaseDashboard } from "@/server/db/release-management";
import { ReleaseAction } from "./ReleaseAction";

const MODES: Array<{ value: TarkovJsonGameMode; label: string }> = [
	{ value: "regular", label: "PVP" },
	{ value: "pve", label: "PVE" },
	{ value: "pvp-season", label: "KORD" },
];
function timestamp(value: number | null) {
	return value
		? new Date(value)
				.toISOString()
				.replace("T", " ")
				.replace(/\.\d{3}Z$/, " UTC")
		: "Unavailable";
}

export default async function DevPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
	if (process.env.NODE_ENV !== "development") notFound();
	const params = await searchParams;
	const mode = MODES.find((entry) => entry.value === params.mode) ?? MODES[0];
	const requestedPage = Number(params.page ?? 1);
	const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10000) : 1;
	let dashboard;
	let error: string | null = null;
	try {
		dashboard = await getReleaseDashboard(mode.value, (page - 1) * 20);
	} catch (cause) {
		error = cause instanceof Error ? cause.message : String(cause);
	}

	return (
		<main className="container mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-8 sm:px-6">
			<header className="space-y-2">
				<p className="text-xs font-semibold uppercase tracking-[0.22em] text-tarkov-green">Development only</p>
				<h1 className="text-3xl font-bold tracking-tight">Database releases</h1>
				<p className="max-w-3xl text-sm leading-6 text-gray-400">
					Manage the shared release used by apps connected to this database, and preview a different release in your local development browser.
				</p>
			</header>
			<nav aria-label="Release game mode" className="flex gap-2">
				{MODES.map((entry) => (
					<Link
						key={entry.value}
						href={`/dev?mode=${entry.value}`}
						aria-current={entry.value === mode.value ? "page" : undefined}
						className={`rounded-md border px-5 py-2 text-sm ${entry.value === mode.value ? "border-tarkov-green bg-tarkov-green/10 text-tarkov-green" : "border-border text-gray-400"}`}
					>
						{entry.label}
					</Link>
				))}
			</nav>
			{error && (
				<p role="alert" className="rounded-xl border border-red-900 bg-red-950/20 p-5 text-sm text-red-300">
					Unable to load releases: {error}
				</p>
			)}
			{dashboard && (
				<>
					<div className="grid gap-4 md:grid-cols-2">
						<section className="space-y-3 rounded-xl border border-border bg-card p-5">
							<div className="flex items-center justify-between gap-3">
								<h2 className="font-semibold">Shared release · {mode.label}</h2>
								<span className="rounded-full bg-tarkov-green/10 px-3 py-1 text-xs text-tarkov-green">{dashboard.pinned ? "Pinned" : "Automatic"}</span>
							</div>
							<p className="break-all font-mono text-sm">{dashboard.sharedReleaseId ?? "No active release"}</p>
							<p className="text-xs leading-5 text-gray-400">
								{dashboard.pinned
									? "db:update uploads new releases but keeps this release active."
									: "db:update automatically activates new releases for this mode."}{" "}
								Shared changes affect production when it uses this database.
							</p>
							{dashboard.pinned && (
								<ReleaseAction mode={mode.value} action="resume">
									Resume automatic updates
								</ReleaseAction>
							)}
						</section>
						<section className="space-y-3 rounded-xl border border-border bg-card p-5">
							<div className="flex items-center justify-between gap-3">
								<h2 className="font-semibold">Local development</h2>
								<span className="rounded-full bg-gray-500/10 px-3 py-1 text-xs text-gray-400">{dashboard.override ? "Override" : "Following shared"}</span>
							</div>
							<p className="break-all font-mono text-sm">{dashboard.override ?? dashboard.effective.releaseId ?? "Unavailable"}</p>
							<p className="text-xs leading-5 text-gray-400">
								Applies to this browser for 30 days, only under npm run dev. Other modes and the shared release keep their own selections.
							</p>
							{dashboard.effective.error && (
								<p role="alert" className="text-xs text-red-300">
									{dashboard.effective.error}
								</p>
							)}
							{dashboard.override && (
								<ReleaseAction mode={mode.value} action="clear-local">
									Follow shared release
								</ReleaseAction>
							)}
						</section>
					</div>
					<section className="overflow-hidden rounded-xl border border-border bg-card">
						<div className="border-b border-border p-5">
							<h2 className="font-semibold">Release history</h2>
							<p className="mt-1 text-xs text-gray-400">Newest first. Pin a ready release to select it and prevent automatic updates.</p>
						</div>
						{!dashboard.releases.length ? (
							<p className="p-6 text-sm text-gray-400">No releases on this page.</p>
						) : (
							<ul className="divide-y divide-border">
								{dashboard.releases.map((release) => (
									<li key={release.releaseId} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
										<div className="min-w-0 space-y-2">
											<div className="flex flex-wrap items-center gap-2">
												<span className="break-all font-mono text-sm">{release.releaseId}</span>
												<span className={`text-xs ${release.status === "ready" ? "text-tarkov-green" : "text-amber-300"}`}>{release.status}</span>
												{release.releaseId === dashboard.sharedReleaseId && (
													<span className="rounded bg-tarkov-green/10 px-2 py-1 text-xs text-tarkov-green">Current shared</span>
												)}
												{release.releaseId === dashboard.override && (
													<span className="rounded bg-blue-400/10 px-2 py-1 text-xs text-blue-300">Local override</span>
												)}
											</div>
											<p className="text-xs text-gray-400">
												Generated {timestamp(release.generatedAt)} · Uploaded {timestamp(release.uploadedAt)}
											</p>
											<p className="text-xs text-gray-500">
												Schema {release.schemaVersion} · {release.counts.entity ?? 0} entities · {release.counts.itemView ?? 0} item views ·{" "}
												{release.counts.itemSearch ?? 0} search rows
											</p>
										</div>
										<div className="flex shrink-0 flex-wrap gap-2">
											<ReleaseAction
												mode={mode.value}
												action="local"
												releaseId={release.releaseId}
												disabled={release.status !== "ready" || release.releaseId === dashboard.override}
											>
												Use in local dev
											</ReleaseAction>
											<ReleaseAction
												mode={mode.value}
												action="pin"
												releaseId={release.releaseId}
												disabled={release.status !== "ready" || (release.releaseId === dashboard.sharedReleaseId && dashboard.pinned)}
											>
												Pin shared release
											</ReleaseAction>
										</div>
									</li>
								))}
							</ul>
						)}
					</section>
					<nav aria-label="Release history pages" className="flex items-center justify-between text-sm text-gray-400">
						{page > 1 ? <Link href={`/dev?mode=${mode.value}&page=${page - 1}`}>← Newer releases</Link> : <span />}
						<span>Page {page}</span>
						{dashboard.hasMore ? <Link href={`/dev?mode=${mode.value}&page=${page + 1}`}>Older releases →</Link> : <span />}
					</nav>
				</>
			)}
		</main>
	);
}
