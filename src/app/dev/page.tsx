import Link from "next/link";
import { notFound } from "next/navigation";
import { CACHE_DOMAINS, getCachePolicy, type CacheDomain } from "@/server/cache";
import {
    getCurrentJsonFullQuestData,
    getStoredJsonFullQuestData,
} from "@/server/services/questsJson";
import {
    compareFullQuestData,
    type ChangedQuest,
} from "@/server/services/questCacheComparison";
import { ChangedQuestDiff } from "@/app/dev/_components/ChangedQuestDiff";
import type { TarkovJsonGameMode } from "@/server/services/tarkovJson/client";

const DOMAIN_LABELS: Record<CacheDomain, string> = {
    hideoutStations: "Hideout stations",
    itemCatalog: "Item catalog",
    itemBarters: "Item barters",
    itemCrafts: "Item crafts",
    quests: "Item quests",
    questsFull: "Full quests",
    traders: "Traders",
};

const NEXT_CACHE_DOMAINS = new Set<CacheDomain>([
    "hideoutStations",
    "quests",
    "questsFull",
    "traders",
]);

const MODES: Array<{ value: TarkovJsonGameMode; label: string }> = [
    { value: "regular", label: "PVP" },
    { value: "pve", label: "PVE" },
    { value: "pvp-season", label: "KORD" },
];

function parseMode(value: string | undefined): TarkovJsonGameMode {
    return MODES.some((mode) => mode.value === value)
        ? (value as TarkovJsonGameMode)
        : "regular";
}

function Status({ enabled, unavailable = false }: { enabled: boolean; unavailable?: boolean }) {
    if (unavailable) return <span className="text-xs text-gray-600">Not used</span>;
    return (
        <span
            className={
                enabled
                    ? "inline-flex rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-300"
                    : "inline-flex rounded-full bg-red-500/15 px-2 py-1 text-xs font-medium text-red-300"
            }
        >
            {enabled ? "Enabled" : "Disabled"}
        </span>
    );
}

function formatTimestamp(value: number) {
    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "medium",
    }).format(value);
}

interface DevPageProps {
    searchParams: Promise<{ compare?: string; mode?: string }>;
}

export default async function DevPage({ searchParams }: DevPageProps) {
    if (process.env.NODE_ENV !== "development") notFound();

    const params = await searchParams;
    const mode = parseMode(params.mode);
    const shouldCompare = params.compare === "1";
    let comparison:
        | Awaited<ReturnType<typeof compareQuestSnapshots>>
        | null = null;
    let comparisonError: string | null = null;

    if (shouldCompare) {
        try {
            comparison = await compareQuestSnapshots(mode);
        } catch (error) {
            comparisonError = error instanceof Error ? error.message : String(error);
        }
    }

    return (
        <main className="container mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 py-8 sm:px-6">
            <header className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-tarkov-green">
                    Development only
                </p>
                <h1 className="text-3xl font-bold tracking-tight">Developer panel</h1>
                <p className="max-w-3xl text-sm leading-6 text-gray-400">
                    Inspect the effective cache policy and compare the stored full-quest
                    Redis snapshot with a fresh, no-store Tarkov.dev response. Comparisons
                    never update Redis.
                </p>
            </header>

            <section className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="border-b border-border px-5 py-4">
                    <h2 className="font-semibold">Effective cache policy</h2>
                    <p className="mt-1 text-xs text-gray-500">
                        Global environment flags override dataset flags. Restart the dev
                        server after changing them.
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="bg-black/15 text-xs uppercase tracking-wide text-gray-500">
                            <tr>
                                <th className="px-5 py-3">Dataset</th>
                                <th className="px-5 py-3">Next.js cache</th>
                                <th className="px-5 py-3">Redis read</th>
                                <th className="px-5 py-3">Redis write</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {CACHE_DOMAINS.map((domain) => {
                                const policy = getCachePolicy(domain);
                                return (
                                    <tr key={domain}>
                                        <td className="px-5 py-3 font-medium">{DOMAIN_LABELS[domain]}</td>
                                        <td className="px-5 py-3">
                                            <Status
                                                enabled={policy.next}
                                                unavailable={!NEXT_CACHE_DOMAINS.has(domain)}
                                            />
                                        </td>
                                        <td className="px-5 py-3"><Status enabled={policy.redisRead} /></td>
                                        <td className="px-5 py-3"><Status enabled={policy.redisWrite} /></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="space-y-5 rounded-xl border border-border bg-card p-5">
                <div>
                    <h2 className="font-semibold">Quest history</h2>
                    <p className="mt-1 text-sm text-gray-400">
                        Select a dataset and fetch the current upstream quest data for a
                        field-level comparison with the existing Redis snapshot.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {MODES.map((candidate) => (
                        <Link
                            key={candidate.value}
                            href={`/dev?mode=${candidate.value}`}
                            className={
                                candidate.value === mode
                                    ? "rounded-md bg-tarkov-green px-4 py-2 text-sm font-semibold text-black"
                                    : "rounded-md border border-border px-4 py-2 text-sm text-gray-300 hover:border-gray-500"
                            }
                        >
                            {candidate.label}
                        </Link>
                    ))}
                    <Link
                        href={`/dev?mode=${mode}&compare=1`}
                        className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200"
                    >
                        {shouldCompare ? "Compare again" : "Compare with Tarkov.dev"}
                    </Link>
                </div>

                {comparisonError && (
                    <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
                        Comparison failed: {comparisonError}
                    </div>
                )}

                {comparison?.stored === null && (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                        No valid stored full-quest snapshot was found for this mode. The
                        upstream request completed, but there is nothing to compare yet.
                    </div>
                )}

                {comparison?.stored && comparison.result && (
                    <div className="space-y-5">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            <Metric label="Stored" value={comparison.stored.data.quests.length} />
                            <Metric label="Upstream" value={comparison.current.data.quests.length} />
                            <Metric label="Added" value={comparison.result.added.length} tone="green" />
                            <Metric label="Removed" value={comparison.result.removed.length} tone="red" />
                            <Metric label="Changed" value={comparison.result.changed.length} tone="amber" />
                        </div>
                        <p className="text-xs text-gray-500">
                            Stored {formatTimestamp(comparison.stored.updatedAt)} · Checked {formatTimestamp(comparison.current.updatedAt)} · {comparison.result.unchangedCount} unchanged
                        </p>
                        <QuestChanges title="Added quests" rows={comparison.result.added} />
                        <QuestChanges title="Removed quests" rows={comparison.result.removed} />
                        <ChangedQuestList rows={comparison.result.changed} />
                    </div>
                )}
            </section>
        </main>
    );
}

async function compareQuestSnapshots(mode: TarkovJsonGameMode) {
    const [stored, current] = await Promise.all([
        getStoredJsonFullQuestData(mode),
        getCurrentJsonFullQuestData(mode),
    ]);
    return {
        stored,
        current,
        result: stored ? compareFullQuestData(stored, current) : null,
    };
}

function Metric({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "green" | "red" | "amber" }) {
    const toneClass = {
        default: "text-white",
        green: "text-emerald-300",
        red: "text-red-300",
        amber: "text-amber-300",
    }[tone];
    return (
        <div className="rounded-lg border border-border bg-black/15 p-4">
            <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
            <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
        </div>
    );
}

function QuestChanges({ title, rows }: {
    title: string;
    rows: Array<{ id: string; name: string }>;
}) {
    if (rows.length === 0) return null;
    return (
        <details className="rounded-lg border border-border bg-black/10" open>
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
                {title} ({rows.length})
            </summary>
            <div className="divide-y divide-border border-t border-border">
                {rows.map((row) => (
                    <div key={row.id} className="px-4 py-3">
                        <div className="text-sm font-medium">{row.name}</div>
                        <code className="text-xs text-gray-600">{row.id}</code>
                    </div>
                ))}
            </div>
        </details>
    );
}

function ChangedQuestList({ rows }: { rows: ChangedQuest[] }) {
    if (rows.length === 0) return null;
    return (
        <details className="rounded-lg border border-border bg-black/10" open>
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
                Changed quests ({rows.length})
            </summary>
            <div className="divide-y divide-border border-t border-border">
                {rows.map((row) => (
                    <ChangedQuestDiff key={row.id} row={row} />
                ))}
            </div>
        </details>
    );
}
