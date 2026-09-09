import Link from "next/link";
import { notFound } from "next/navigation";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { getReleaseDashboard } from "@/server/db/release-management";

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

export default async function DevPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	if (process.env.NODE_ENV !== "development") notFound();
	const params = await searchParams;
	const mode = MODES.find((entry) => entry.value === params.mode) ?? MODES[0];
	let dashboard;
	let error: string | null = null;
	try {
		dashboard = await getReleaseDashboard(mode.value);
	} catch (cause) {
		error = cause instanceof Error ? cause.message : String(cause);
	}
	return (
		<main className="container mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-8 sm:px-6">
			<header className="space-y-2">
				<p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Development only</p>
				<h1 className="text-3xl font-bold tracking-tight">Current dataset</h1>
				<p className="text-sm leading-6 text-muted-foreground">
					Publication status for the current data in each game mode.
				</p>
			</header>
			<nav aria-label="Dataset game mode" className="flex gap-2">
				{MODES.map((entry) => (
					<Link
						key={entry.value}
						href={`/dev?mode=${entry.value}`}
						aria-current={entry.value === mode.value ? "page" : undefined}
						className={`rounded-md border px-5 py-2 text-sm ${entry.value === mode.value ? "border-brand bg-brand/10 text-brand" : "border-border text-muted-foreground"}`}
					>
						{entry.label}
					</Link>
				))}
			</nav>
			{error && (
				<p role="alert" className="rounded-xl border border-danger bg-danger-surface/20 p-5 text-sm text-danger">
					Unable to load current dataset: {error}
				</p>
			)}
			{!error && !dashboard && <p className="text-sm text-muted-foreground">No current dataset for {mode.label}.</p>}
			{dashboard && (
				<section className="space-y-4 rounded-xl border border-border bg-card p-5">
					<h2 className="font-semibold">
						{mode.label} · {dashboard.status}
					</h2>
					<p className="break-all font-mono text-sm">{dashboard.releaseId}</p>
					<dl className="grid gap-4 text-sm sm:grid-cols-3">
						<div>
							<dt className="text-muted-foreground">Generated</dt>
							<dd>{timestamp(dashboard.generatedAt)}</dd>
						</div>
						<div>
							<dt className="text-muted-foreground">Uploaded</dt>
							<dd>{timestamp(dashboard.uploadedAt)}</dd>
						</div>
						<div>
							<dt className="text-muted-foreground">Published</dt>
							<dd>{timestamp(dashboard.activatedAt)}</dd>
						</div>
					</dl>
					<p className="text-sm text-muted-foreground">
						Schema {dashboard.schemaVersion} · {dashboard.counts.entity ?? 0} entities ·{" "}
						{dashboard.counts.itemView ?? 0} item views · {dashboard.counts.itemSearch ?? 0} search rows
					</p>
				</section>
			)}
		</main>
	);
}
