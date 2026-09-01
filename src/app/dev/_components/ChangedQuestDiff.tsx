"use client";

import { useState } from "react";
import {
    buildSideBySideJsonDiff,
    type TextDiffSegment,
} from "@/lib/utils/json-text-diff";
import type { ChangedQuest } from "@/server/services/questCacheComparison";

export function ChangedQuestDiff({ row }: { row: ChangedQuest }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <details
            className="group"
            id={`quest-${row.id}`}
            onToggle={(event) => setIsOpen(event.currentTarget.open)}
        >
            <summary className="cursor-pointer list-none px-4 py-3 marker:hidden hover:bg-white/[0.025]">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="text-sm font-medium group-open:text-amber-200">
                            {row.name}
                        </div>
                        <code className="text-xs text-gray-600">{row.id}</code>
                    </div>
                    <div className="flex max-w-2xl flex-wrap justify-end gap-1.5 text-[11px] text-amber-200">
                        {row.changedFields.join(", ")}
                    </div>
                </div>
            </summary>
            {isOpen && <QuestJsonComparison row={row} />}
        </details>
    );
}

function QuestJsonComparison({ row }: { row: ChangedQuest }) {
    return (
        <div className="border-t border-border px-4 pb-4">
            <div className="grid grid-cols-2 gap-6 py-3 text-xs font-semibold uppercase tracking-wide">
                <div className="text-sky-300">Ours · Redis</div>
                <div className="text-emerald-300">Tarkov.dev · Current</div>
            </div>
            {row.changedFields.map((field) => (
                <ChangedFieldDiff
                    key={field}
                    field={field}
                    ours={row.stored[field]}
                    current={row.current[field]}
                />
            ))}
        </div>
    );
}

function ChangedFieldDiff({
    field,
    ours,
    current,
}: {
    field: string;
    ours: unknown;
    current: unknown;
}) {
    const rows = buildSideBySideJsonDiff(ours, current);
    return (
        <section className="border-t border-border py-4 first:border-t-0 first:pt-0">
            <h4 className="mb-3 text-xs font-semibold text-amber-200">{field}</h4>
            <div className="max-h-[42rem] overflow-auto font-mono text-[11px] leading-5 text-gray-400">
                {rows.map((diffRow, index) => (
                    <div key={index} className="grid min-w-[44rem] grid-cols-2 gap-6">
                        <DiffLine segments={diffRow.left} side="ours" />
                        <DiffLine segments={diffRow.right} side="current" />
                    </div>
                ))}
            </div>
        </section>
    );
}

function DiffLine({
    segments,
    side,
}: {
    segments: TextDiffSegment[] | null;
    side: "ours" | "current";
}) {
    return (
        <div className="min-h-5 whitespace-pre">
            {segments?.map((segment, index) =>
                segment.changed ? (
                    <mark
                        key={index}
                        className={
                            side === "ours"
                                ? "bg-rose-500/30 text-rose-100"
                                : "bg-emerald-500/30 text-emerald-100"
                        }
                    >
                        {segment.text || " "}
                    </mark>
                ) : (
                    <span key={index}>{segment.text}</span>
                ),
            )}
        </div>
    );
}
