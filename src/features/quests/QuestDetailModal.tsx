"use client";

import type { MouseEvent } from "react";
import { X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { FullQuest } from "@/types";
import { QuestCard, type QuestRef } from "./QuestCard";
import { useQuestsContext } from "./QuestsContext";

interface QuestDetailModalProps {
    quest: FullQuest | null;
    isOpen: boolean;
    onClose: () => void;
    onQuestChange: (questId: string) => void;
}

function toRef(id: string, fallbackName: string, questsById: Map<string, FullQuest>): QuestRef {
    const quest = questsById.get(id);
    return {
        id,
        name: quest?.name ?? fallbackName,
        trader: quest
            ? {
                  imageLink: quest.trader.imageLink ?? null,
                  image4xLink: quest.trader.image4xLink ?? null,
                  name: quest.trader.name,
              }
            : { imageLink: null, image4xLink: null, name: "?" },
    };
}

function getPrerequisiteType(statuses: string[]): QuestRef["prerequisiteType"] {
    const normalized = statuses.map((status) => status.toLowerCase());
    if (normalized.includes("complete") && normalized.includes("failed")) return "resolved";
    if (normalized.includes("failed")) return "failed";
    if (normalized.includes("active")) return "active";
    return "complete";
}

export function QuestDetailModal({ quest, isOpen, onClose, onQuestChange }: QuestDetailModalProps) {
    const { questsById, leadsToByQuestId, showDebug } = useQuestsContext();

    const handleQuestLinkClick = (questId: string, event?: MouseEvent<HTMLAnchorElement>) => {
        event?.preventDefault();
        event?.stopPropagation();
        if (questsById.has(questId)) onQuestChange(questId);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                showCloseButton={false}
                className="max-h-[min(88vh,900px)] max-w-4xl overflow-y-auto border-white/10 bg-[#0d0d0d] p-2 pt-2 shadow-2xl sm:p-6 sm:pt-8"
            >
                <DialogTitle className="sr-only">{quest?.name ?? "Quest details"}</DialogTitle>
                <DialogClose asChild>
                    <button
                        type="button"
                        aria-label="Close quest details"
                        className="absolute right-1 top-1 z-10 flex size-8 items-center justify-center rounded-full text-gray-300 shadow-lg transition-colors hover:border-white/25 hover:bg-[#181818] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tarkov-green"
                    >
                        <X size={16} aria-hidden="true" />
                    </button>
                </DialogClose>
                {quest && (
                    <QuestCard
                        quest={quest}
                        domId={`quest-modal-${quest.id}`}
                        forceExpand
                        prerequisiteQuests={quest.taskRequirements.map((req) => ({
                            ...toRef(req.task.id, req.task.name, questsById),
                            prerequisiteType: getPrerequisiteType(req.status),
                        }))}
                        leadsToQuests={(leadsToByQuestId.get(quest.id) ?? []).map((id) =>
                            toRef(id, id, questsById),
                        )}
                        showDebugButton={showDebug}
                        onQuestLinkClick={handleQuestLinkClick}
                        className="border-0!"
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
