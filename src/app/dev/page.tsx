import { notFound } from "next/navigation";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import {
    getConfiguredReleaseInfo,
    type ConfiguredReleaseInfo,
} from "@/server/db/release-info";

const MODES: Array<{ value: TarkovJsonGameMode; label: string }> = [
    { value: "regular", label: "PVP" },
    { value: "pve", label: "PVE" },
    { value: "pvp-season", label: "KORD" },
];

function formatTimestamp(value: number | null) {
    if (!value) return "Unavailable";
    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "medium",
    }).format(value);
}

export default async function DevPage() {
    if (process.env.NODE_ENV !== "development") notFound();

    const releases = await Promise.all(
        MODES.map(async ({ value, label }) => {
            try {
                return { label, info: await getConfiguredReleaseInfo(value), error: null };
            } catch (error) {
                return {
                    label,
                    info: null,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        }),
    );

    return (
        <main className="container mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 py-8 sm:px-6">
            <header className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-tarkov-green">
                    Development only
                </p>
                <h1 className="text-3xl font-bold tracking-tight">Database releases</h1>
                <p className="max-w-3xl text-sm leading-6 text-gray-400">
                    Inspect the immutable Turso releases currently selected by the
                    application. Runtime page data no longer reads Tarkov.dev or Redis.
                </p>
            </header>

            <div className="grid gap-5 lg:grid-cols-3">
                {releases.map((release) => (
                    <ReleaseCard
                        key={release.label}
                        label={release.label}
                        info={release.info}
                        error={release.error}
                    />
                ))}
            </div>
        </main>
    );
}

function ReleaseCard({
    label,
    info,
    error,
}: {
    label: string;
    info: ConfiguredReleaseInfo | null;
    error: string | null;
}) {
    return (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
                <h2 className="font-semibold">{label}</h2>
                <p className="mt-1 font-mono text-xs text-gray-500">
                    {info?.mode ?? "Unavailable"}
                </p>
            </div>
            {info ? (
                <dl className="divide-y divide-border text-sm">
                    <Row label="Release" value={info.releaseId} mono />
                    <Row label="Schema" value={String(info.schemaVersion)} />
                    <Row label="Generated" value={formatTimestamp(info.generatedAt)} />
                    <Row label="Uploaded" value={formatTimestamp(info.uploadedAt)} />
                    <Row label="Entities" value={String(info.recordCounts.entity ?? 0)} />
                    <Row
                        label="Item views"
                        value={String(info.recordCounts.itemView ?? 0)}
                    />
                    <Row
                        label="Search rows"
                        value={String(info.recordCounts.itemSearch ?? 0)}
                    />
                </dl>
            ) : (
                <p className="p-5 text-sm text-red-300">{error}</p>
            )}
        </section>
    );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex items-center justify-between gap-4 px-5 py-3">
            <dt className="text-gray-500">{label}</dt>
            <dd className={mono ? "font-mono text-xs text-gray-200" : "text-gray-200"}>
                {value}
            </dd>
        </div>
    );
}
