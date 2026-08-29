"use client";

import { useUserStore } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";
import type { QuestRef } from "./types";

interface QuestRelationChipProps {
    questRef: QuestRef;
    direction?: "requirement" | "unlock";
    onQuestLinkClick?: (questId: string, event?: React.MouseEvent<HTMLAnchorElement>) => void;
}

export function QuestRelationChip({ questRef, direction = "requirement", onQuestLinkClick }: QuestRelationChipProps) {
    const prerequisiteCompleted = useUserStore((state) => !!state.completedQuests[questRef.id]);
    const prerequisiteFailed = useUserStore((state) => !!state.failedQuests[questRef.id]);
    const prerequisiteHint =
        questRef.prerequisiteType === "complete"
            ? "This quest needs to be completed"
            : questRef.prerequisiteType === "active"
              ? "This quest needs to be accepted, completed, or failed"
              : questRef.prerequisiteType === "failed"
                ? "This quest needs to be failed"
                : questRef.prerequisiteType === "resolved"
                  ? "This quest needs to be completed or failed"
                  : null;
    const prerequisiteSatisfied =
        (questRef.prerequisiteType === "complete" && prerequisiteCompleted) ||
        (questRef.prerequisiteType === "failed" && prerequisiteFailed) ||
        (questRef.prerequisiteType === "resolved" &&
            (prerequisiteCompleted || prerequisiteFailed)) ||
        (questRef.prerequisiteType === "active" && (prerequisiteCompleted || prerequisiteFailed));

    return (
        <a
            href={`#quest-${questRef.id}`}
            onClick={(e) => {
                e.stopPropagation();
                onQuestLinkClick?.(questRef.id, e);
            }}
            className="flex min-h-7 items-center gap-2 rounded border border-white/10 bg-black/40 px-2.5 py-1 text-xs text-gray-400 transition-colors hover:border-white/25 hover:text-gray-300"
        >
            {questRef.prerequisiteType && (
                <span
                    title={prerequisiteHint ?? undefined}
                    className={cn(
                        "shrink-0 text-[11px] font-medium",
                        questRef.prerequisiteType === "complete"
                            ? prerequisiteSatisfied
                                ? "text-tarkov-green"
                                : "text-gray-500"
                            : questRef.prerequisiteType === "failed"
                              ? prerequisiteSatisfied
                                  ? "text-red-300"
                                  : "text-gray-500"
                              : questRef.prerequisiteType === "resolved"
                                ? prerequisiteSatisfied
                                    ? "text-tarkov-green"
                                    : "text-gray-500"
                                : "text-blue-300",
                    )}
                >
                    {questRef.prerequisiteType === "complete"
                        ? direction === "unlock" ? "On complete" : "Complete"
                        : questRef.prerequisiteType === "failed"
                          ? direction === "unlock" ? "On fail" : "Fail"
                          : questRef.prerequisiteType === "resolved"
                            ? direction === "unlock" ? "On complete/fail" : "Complete/Fail"
                            : direction === "unlock" ? "On accept" : "Accept"}
                </span>
            )}
            {(questRef.trader.image4xLink ?? questRef.trader.imageLink) ? (
                <img
                    src={questRef.trader.image4xLink ?? questRef.trader.imageLink ?? ""}
                    alt={questRef.trader.name}
                    className="h-4 w-4 shrink-0 rounded-full object-cover"
                />
            ) : (
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[9px]">
                    {questRef.trader.name[0]}
                </span>
            )}
            {questRef.name}
        </a>
    );
}

