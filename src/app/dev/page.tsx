import Link from "next/link";
import { notFound } from "next/navigation";
import { GAME_MODE_CONFIG, GAME_MODES, type TarkovJsonGameMode } from "@/lib/game-mode";
import { isDev } from "@/lib/is-dev";
import { getCatalogDashboard, getMarketWorkerDashboard } from "@/server/db/postgres-dashboard";
import { MarketWorkerPanel } from "./MarketWorkerPanel";
import { ItemImageGallery } from "./ItemImageGallery";

const MODES: Array<{ value: TarkovJsonGameMode; label: string }> = GAME_MODES.map((mode) => ({
	value: GAME_MODE_CONFIG[mode].dataMode,
	label: GAME_MODE_CONFIG[mode].label,
}));
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
	if (!isDev) notFound();
	const params = await searchParams;
	const mode = MODES.find((entry) => entry.value === params.mode) ?? MODES[0];
	let dashboard;
	let error: string | null = null;
	try {
		dashboard = await getCatalogDashboard(mode.value);
	} catch (cause) {
		error = cause instanceof Error ? cause.message : String(cause);
	}
	let market;
	let marketError: string | null = null;
	try {
		market = await getMarketWorkerDashboard(mode.value);
	} catch (cause) {
		marketError = cause instanceof Error ? cause.message : String(cause);
	}
	return (
		<main className="container mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-8 sm:px-6">
			<header className="space-y-2">
				<p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Development only</p>
				<h1 className="text-3xl font-bold tracking-tight">Current dataset</h1>
				<p className="text-sm leading-6 text-muted-foreground">
					Current PostgreSQL catalog status for the selected game mode.
				</p>
			</header>
			<ItemImageGallery />
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
						{mode.label} · PostgreSQL {dashboard.status}
					</h2>
					<p className="break-all font-mono text-sm">Content version {dashboard.contentVersion}</p>
					<dl className="grid gap-4 text-sm sm:grid-cols-3">
						<div>
							<dt className="text-muted-foreground">Last checked</dt>
							<dd>{timestamp(dashboard.checkedAt)}</dd>
						</div>
						<div>
							<dt className="text-muted-foreground">Last content update</dt>
							<dd>{timestamp(dashboard.updatedAt)}</dd>
						</div>
						<div>
							<dt className="text-muted-foreground">Discovery import</dt>
							<dd>{dashboard.discoveryInitialized ? "Initialized" : "Pending"}</dd>
						</div>
					</dl>
					<p className="text-sm text-muted-foreground">
						{dashboard.counts.items} items · {dashboard.counts.stations} stations · {dashboard.counts.quests} quests ·{" "}
						{dashboard.counts.crafts} crafts · {dashboard.counts.barters} barters · {dashboard.counts.itemDetails} item
						details
					</p>
				</section>
			)}
			{marketError && (
				<p role="alert" className="rounded-xl border border-danger bg-danger-surface/20 p-5 text-sm text-danger">
					Unable to load market worker status: {marketError}
				</p>
			)}
			{market && <MarketWorkerPanel dashboard={market} modeValue={mode.value} />}
		</main>
	);
}
