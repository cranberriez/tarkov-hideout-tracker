"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, CircleAlert, Database } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
import { useUserStore } from "@/lib/stores/useUserStore";
import { formatRelativeUpdatedAt, formatUpdatedAt } from "@/lib/utils/format-time";
import type { DataStatusPayload } from "@/types/contracts";
import { dataStatusQueryOptions } from "@/lib/query/status";

interface StatusRowProps {
    label: string;
    value: string;
    title?: string;
    state?: "ok" | "warning" | "error" | "neutral";
}

function StatusRow({ label, value, title, state = "neutral" }: StatusRowProps) {
    const dotClass =
        state === "ok"
            ? "bg-success"
            : state === "warning"
              ? "bg-warning"
              : state === "error"
                ? "bg-danger"
                : "bg-muted";

    return (
        <div className="ml-4 flex items-start justify-between gap-4 border-b border-highlight/5 py-3.5 last:border-0">
            <div className="flex min-w-0 items-start gap-2.5">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${dotClass}`} />
                <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {label}
                    </div>
                </div>
            </div>
            <div title={title} className="shrink-0 text-right text-sm text-foreground">{value}</div>
        </div>
    );
}

function freshness(timestamp: number | null) {
    if (!timestamp) return { value: "Unavailable", title: undefined };
    return {
        value: formatRelativeUpdatedAt(timestamp) ?? "Available",
        title: formatUpdatedAt(timestamp) ?? undefined,
    };
}

export function DataStatusDialog() {
    const gameMode = useUserStore((state) => state.gameMode);
    const [isOpen, setIsOpen] = useState(false);
    const requestedMode = toTarkovJsonGameMode(gameMode);
    const statusRequest = useQuery({ ...dataStatusQueryOptions(requestedMode), enabled: isOpen });
    const status: DataStatusPayload | null = statusRequest.data ?? null;
    const requestError = statusRequest.isError ? "Data status could not be loaded." : null;
    const isLoading = isOpen && statusRequest.isPending;
    const stations = status?.stations ?? null;
    const items = status?.items ?? null;
    const stationFreshness = freshness(stations?.updatedAt ?? null);
    const itemFreshness = freshness(items?.updatedAt ?? null);
    const prices = status?.prices ?? null;
    const priceError = requestError ?? prices?.error;
    const priceFreshness = freshness(prices?.changedAt ?? null);
    const priceCheckFreshness = freshness(prices?.checkedAt ?? null);
    const releaseId = status?.releaseId ?? null;
    const hasCoreError = Boolean(
        requestError ||
            (status && (!stations?.available || !items?.available)),
    );
    const hasDatasetError = hasCoreError || Boolean(
        status && (!status.quests?.available || !status.crafts?.available || !status.barters?.available),
    );
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <span className="inline-flex items-baseline font-mono text-[10px] uppercase tracking-widest text-subtle-foreground">
                <span aria-hidden="true">[&nbsp;</span>
                <DialogTrigger asChild>
                    <button
                        type="button"
                        className="text-muted-foreground transition-colors hover:text-brand hover:underline focus-visible:text-brand focus-visible:underline focus-visible:outline-none"
                    >
                        Status
                    </button>
                </DialogTrigger>
                <span aria-hidden="true">&nbsp;]</span>
            </span>
            <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto p-0">
                <DialogHeader className="border-b border-border-color px-4 py-3.5 pr-11">
                    <DialogTitle className="flex items-center gap-2">
                        <Activity aria-hidden="true" className="size-5 text-brand" />
                        Data status
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Current dataset status, freshness, and price updates.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-4 pt-1 pb-3">
                    <div className="mb-1.5 flex items-center gap-2 pt-3 text-xs font-semibold uppercase tracking-wider text-foreground">
                        {hasDatasetError ? (
                            <CircleAlert aria-hidden="true" className="size-4 text-danger" />
                        ) : (
                            <CheckCircle2 aria-hidden="true" className="size-4 text-success" />
                        )}
                        {isLoading
                            ? "Checking core data"
                            : hasDatasetError
                              ? "Some data is unavailable"
                              : status
                                ? "Core data is available"
                                : "Core data status is unavailable"}
                    </div>

                    <StatusRow
                        label="API provider"
                        value={
                            isLoading
                                ? "Checking connection"
                                : hasCoreError
                                ? "Connection failed"
                                : "Turso"
                        }
                        state={
                            isLoading
                                ? "neutral"
                                : hasCoreError
                                  ? "error"
                                  : "ok"
                        }
                    />
                    <StatusRow
                        label="Data revision"
                        value={releaseId ?? "Checking"}
                    />
                    <StatusRow
                        label="Active dataset"
                        value={`${gameMode} · ${requestedMode}`}
                        state="ok"
                    />
                    <StatusRow
                        label="Cache"
                        value="Next.js / CDN"
                        state="ok"
                    />
                    <StatusRow
                        label="Localization"
                        value="Stored labels"
                        state="ok"
                    />

                    <div className="mt-5 flex items-center gap-2 pt-1 text-xs font-semibold uppercase tracking-wider text-foreground">
                        <Database aria-hidden="true" className="size-4 text-muted-foreground" />
                        Freshness
                    </div>
                    <StatusRow
                        label="Hideout stations"
                        value={
                            isLoading
                                ? "Checking"
                                : stations?.error
                                  ? "Error"
                                  : stationFreshness.value
                        }
                        title={stations?.error ?? stationFreshness.title}
                        state={
                            isLoading
                                ? "neutral"
                                : stations?.available
                                  ? "ok"
                                  : "error"
                        }
                    />
                    <StatusRow
                        label="Item catalog"
                        value={
                            isLoading
                                ? "Checking"
                                : items?.error
                                  ? "Error"
                                  : itemFreshness.value
                        }
                        title={items?.error ?? itemFreshness.title}
                        state={
                            isLoading ? "neutral" : items?.available ? "ok" : "error"
                        }
                    />
                    {([
                        ["Quests", status?.quests],
                        ["Craft recipes", status?.crafts],
                        ["Barter recipes", status?.barters],
                    ] as const).map(([label, domain]) => {
                        const updated = freshness(domain?.updatedAt ?? null);
                        return (
                            <StatusRow
                                key={label}
                                label={label}
                                value={isLoading ? "Checking" : requestError ? "Error" : updated.value}
                                title={requestError ?? domain?.error ?? updated.title}
                                state={isLoading ? "neutral" : requestError || domain?.error ? "error" : domain?.available ? "ok" : "warning"}
                            />
                        );
                    })}
                    <StatusRow
                        label="Prices last changed"
                        value={isLoading ? "Checking" : priceError ? "Error" : priceFreshness.value}
                        title={priceError ?? priceFreshness.title}
                        state={isLoading ? "neutral" : priceError ? "error" : prices?.changedAt ? "ok" : "warning"}
                    />
                    <StatusRow
                        label="Prices last checked"
                        value={isLoading ? "Checking" : priceError ? "Error" : priceCheckFreshness.value}
                        title={priceError ?? priceCheckFreshness.title}
                        state={isLoading ? "neutral" : priceError ? "error" : "neutral"}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
