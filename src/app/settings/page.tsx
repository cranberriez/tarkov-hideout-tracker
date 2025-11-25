"use client";

import React, { useMemo, useState } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";

function encodeBase64FromString(value: string) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(value);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return typeof btoa !== "undefined"
        ? btoa(binary)
        : Buffer.from(binary, "binary").toString("base64");
}

function decodeBase64ToString(b64: string) {
    let binary: string;
    if (typeof atob !== "undefined") {
        binary = atob(b64);
    } else {
        binary = Buffer.from(b64, "base64").toString("binary");
    }
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
}

export default function SettingsPage() {
    const stationLevels = useUserStore((state) => state.stationLevels);
    const importStationLevels = useUserStore((state) => state.importStationLevels);
    const resetAll = useUserStore((state) => state.resetAll);

    const [exportCode, setExportCode] = useState("");
    const [importCode, setImportCode] = useState("");
    const [status, setStatus] = useState("");

    const hasProgress = useMemo(() => Object.keys(stationLevels).length > 0, [stationLevels]);

    function buildExportCode() {
        const entries = Object.entries(stationLevels).sort(([a], [b]) => a.localeCompare(b));
        const payload = {
            v: 1,
            d: entries,
        };
        const json = JSON.stringify(payload);
        const b64 = encodeBase64FromString(json);
        const code = `v1-${b64}`;
        setExportCode(code);
        setImportCode(code);
        setStatus("Exported");
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(code).catch(() => undefined);
        }
    }

    function handleImport() {
        try {
            if (!importCode.trim()) {
                setStatus("No code provided");
                return;
            }
            const trimmed = importCode.trim();
            const [prefix, encoded] = trimmed.split("-");
            if (prefix !== "v1" || !encoded) {
                setStatus("Invalid code format");
                return;
            }
            const json = decodeBase64ToString(encoded);
            const payload = JSON.parse(json) as {
                v: number;
                d: [string, number][];
            };
            if (!payload || payload.v !== 1 || !Array.isArray(payload.d)) {
                setStatus("Invalid code payload");
                return;
            }
            const levels: Record<string, number> = {};
            for (const [id, level] of payload.d) {
                if (typeof id === "string" && typeof level === "number") {
                    levels[id] = level;
                }
            }
            importStationLevels(levels);
            setStatus("Import successful");
        } catch (e) {
            setStatus("Failed to import code");
        }
    }

    function handleReset() {
        const confirmed = window.confirm(
            "This will reset all stored data, including hideout progress and settings."
        );
        if (!confirmed) return;
        resetAll();
        setExportCode("");
        setImportCode("");
        setStatus("All data reset");
    }

    return (
        <div className="container mx-auto px-4 sm:px-6 py-6 max-w-2xl space-y-6">
            <h1 className="text-xl sm:text-2xl font-semibold text-white">Settings</h1>

            <div className="bg-card border rounded-lg p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="space-y-1">
                        <div className="text-sm font-medium text-white">
                            Import/Export hideout progress
                        </div>
                        <div className="text-xs text-gray-400 max-w-md">
                            Use a compact code to back up or move your current hideout station
                            levels between browsers.
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto sm:justify-end">
                        <button
                            type="button"
                            onClick={buildExportCode}
                            className="px-3 py-1.5 text-xs sm:text-sm rounded-md border border-foreground/30 bg-foreground/10 hover:bg-foreground/20 text-white transition-colors disabled:opacity-50"
                            disabled={!hasProgress}
                        >
                            Export
                        </button>
                        <button
                            type="button"
                            onClick={handleImport}
                            className="px-3 py-1.5 text-xs sm:text-sm rounded-md border border-foreground/30 bg-foreground/10 hover:bg-foreground/20 text-white transition-colors"
                        >
                            Import
                        </button>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <input
                        type="text"
                        value={importCode}
                        onChange={(e) => setImportCode(e.target.value)}
                        placeholder="v1-..."
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs sm:text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-foreground/50"
                    />
                    {status && <div className="text-xs text-gray-400">{status}</div>}
                </div>
            </div>

            <div className="bg-card border rounded-lg p-4 sm:p-5 space-y-3">
                <div className="text-sm font-medium text-white">Reset all data</div>
                <div className="text-xs text-gray-400 max-w-md">
                    Clears all stored information, including hideout levels, checklist preferences,
                    and setup options. This cannot be undone.
                </div>
                <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center px-3 py-1.5 text-xs sm:text-sm rounded-md border border-red-500/60 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                >
                    Reset all
                </button>
            </div>
        </div>
    );
}
