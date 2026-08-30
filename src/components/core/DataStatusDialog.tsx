"use client";

import { Activity, CheckCircle2, CircleAlert, Database, Languages } from "lucide-react";
import { useDataContext } from "@/app/(data)/_dataContext";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useUserStore } from "@/lib/stores/useUserStore";
import { formatRelativeUpdatedAt, formatUpdatedAt } from "@/lib/utils/format-time";
import type { RedisCacheState } from "@/server/redis";

export interface DataStatusConfig {
    provider: "json" | "graphql";
    configuredProvider: "json" | "graphql";
    activeDataset: "regular" | "pve" | "pvp-season";
    cacheEnabled: boolean;
    redisState: RedisCacheState;
    progressionDataFrozen: boolean;
}

interface StatusRowProps {
    label: string;
    value: string;
    detail?: string;
    state?: "ok" | "warning" | "error" | "neutral";
}

function StatusRow({ label, value, detail, state = "neutral" }: StatusRowProps) {
    const dotClass =
        state === "ok"
            ? "bg-emerald-400"
            : state === "warning"
              ? "bg-amber-400"
              : state === "error"
                ? "bg-red-400"
                : "bg-gray-500";

    return (
        <div className="ml-4 flex items-start justify-between gap-4 border-b border-white/5 py-3.5 last:border-0">
            <div className="flex min-w-0 items-start gap-2.5">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${dotClass}`} />
                <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        {label}
                    </div>
                    {detail && (
                        <div className="mt-1 pl-3 text-xs leading-5 text-gray-500">{detail}</div>
                    )}
                </div>
            </div>
            <div className="shrink-0 text-right text-sm text-gray-100">{value}</div>
        </div>
    );
}

function freshness(timestamp: number | null) {
    if (!timestamp) return { value: "Unavailable", detail: undefined };
    return {
        value: formatRelativeUpdatedAt(timestamp) ?? "Available",
        detail: formatUpdatedAt(timestamp) ?? undefined,
    };
}

export function DataStatusDialog({ config }: { config: DataStatusConfig }) {
    const {
        stations,
        stationsUpdatedAt,
        stationsError,
        stationsDiagnostics,
        items,
        itemsUpdatedAt,
        itemsError,
        itemsDiagnostics,
    } = useDataContext();
    const gameMode = useUserStore((state) => state.gameMode);
    const stationFreshness = freshness(stationsUpdatedAt);
    const itemFreshness = freshness(itemsUpdatedAt);
    const diagnostics = stationsDiagnostics ?? itemsDiagnostics;
    const localePaths = diagnostics?.localePaths ?? [];
    const localizationValue = diagnostics
        ? diagnostics.usedRegularLocaleFallback
            ? "Regular English fallback"
            : "Mode-specific English"
        : config.provider === "json"
          ? "English fallback enabled"
          : "Provided by GraphQL";
    const localizationDetail = diagnostics
        ? localePaths.length > 0
            ? `Loaded dictionaries: ${localePaths.join(", ")}`
            : "The exact dictionary path was not recorded."
        : "This cached response predates locale diagnostics, so the exact dictionary used is unknown.";
    const hasCoreError = Boolean(stationsError || itemsError || !stations || !items);
    const providerError = stationsError ?? itemsError;
    const isUsingStaleFallback = [stationsDiagnostics, itemsDiagnostics].some(
        (entry) => entry?.upstreamStatus === "stale-fallback",
    );
    const redisStatus =
        config.redisState === "available"
            ? { value: "Available", state: "ok" as const }
            : config.redisState === "unavailable"
              ? { value: "Unavailable", state: "warning" as const }
              : config.redisState === "disabled"
                ? { value: "Disabled", state: "neutral" as const }
                : { value: "Not checked", state: "neutral" as const };

    return (
        <Dialog>
            <span className="inline-flex items-baseline font-mono text-[10px] uppercase tracking-widest text-gray-500">
                <span aria-hidden="true">[&nbsp;</span>
                <DialogTrigger asChild>
                    <button
                        type="button"
                        className="text-gray-400 transition-colors hover:text-tarkov-green hover:underline focus-visible:text-tarkov-green focus-visible:underline focus-visible:outline-none"
                    >
                        Status
                    </button>
                </DialogTrigger>
                <span aria-hidden="true">&nbsp;]</span>
            </span>
            <DialogContent className="max-w-md overflow-hidden p-0">
                <DialogHeader className="border-b border-border-color px-4 py-3.5 pr-11">
                    <DialogTitle className="flex items-center gap-2">
                        <Activity aria-hidden="true" className="size-5 text-tarkov-green" />
                        Data status
                    </DialogTitle>
                    <DialogDescription>
                        Current provider, cache, localization, and dataset freshness.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-4 py-1">
                    <div className="mb-1.5 flex items-center gap-2 pt-3 text-xs font-semibold uppercase tracking-wider text-gray-300">
                        {hasCoreError ? (
                            <CircleAlert aria-hidden="true" className="size-4 text-red-400" />
                        ) : (
                            <CheckCircle2 aria-hidden="true" className="size-4 text-emerald-400" />
                        )}
                        {hasCoreError ? "Some data is unavailable" : "Core data is available"}
                    </div>

                    <StatusRow
                        label="API provider"
                        value={
                            hasCoreError
                                ? "Connection failed"
                                : isUsingStaleFallback
                                  ? "Using cached data"
                                : config.provider === "json"
                                  ? "Tarkov.dev JSON"
                                  : "Tarkov.dev GraphQL"
                        }
                        detail={
                            providerError ??
                            (isUsingStaleFallback
                                ? "The latest provider refresh failed; this is the last validated dataset."
                                : config.provider !== config.configuredProvider
                                  ? `${config.activeDataset} requires the JSON provider.`
                                  : `Configured provider: ${config.configuredProvider}.`)
                        }
                        state={hasCoreError ? "error" : isUsingStaleFallback ? "warning" : "ok"}
                    />
                    <StatusRow
                        label="Active dataset"
                        value={`${gameMode} · ${config.activeDataset}`}
                        state="ok"
                    />
                    <StatusRow
                        label="Cache"
                        value={config.cacheEnabled ? "Enabled" : "Disabled"}
                        detail={
                            config.cacheEnabled && config.progressionDataFrozen
                                ? "Progression data is pinned to the last known-good cache."
                                : config.cacheEnabled
                                  ? "Application caching is active; Redis is a best-effort fallback."
                                  : "Development requests go directly to the upstream provider."
                        }
                        state={config.cacheEnabled ? "ok" : "warning"}
                    />
                    <StatusRow
                        label="Redis fallback"
                        value={redisStatus.value}
                        detail={
                            config.redisState === "unavailable"
                                ? "Requests continue through the application cache and upstream provider."
                                : "Redis is optional and is retried on later cache operations."
                        }
                        state={redisStatus.state}
                    />
                    <StatusRow
                        label="Localization"
                        value={localizationValue}
                        detail={localizationDetail}
                        state={
                            diagnostics?.usedRegularLocaleFallback ? "warning" : "ok"
                        }
                    />

                    <div className="mt-5 flex items-center gap-2 pt-1 text-xs font-semibold uppercase tracking-wider text-gray-300">
                        <Database aria-hidden="true" className="size-4 text-gray-400" />
                        Freshness
                    </div>
                    <StatusRow
                        label="Hideout stations"
                        value={stationsError ? "Error" : stationFreshness.value}
                        detail={stationsError ?? stationFreshness.detail}
                        state={stationsError || !stations ? "error" : "ok"}
                    />
                    <StatusRow
                        label="Hideout items"
                        value={itemsError ? "Error" : itemFreshness.value}
                        detail={itemsError ?? itemFreshness.detail}
                        state={itemsError || !items ? "error" : "ok"}
                    />
                    <div className="ml-4 mt-4 flex items-start gap-2 pb-4 pt-0.5 text-[11px] leading-5 text-gray-500">
                        <Languages aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                        Translation fallback changes labels only. The selected mode&apos;s base records
                        and IDs remain unchanged.
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
