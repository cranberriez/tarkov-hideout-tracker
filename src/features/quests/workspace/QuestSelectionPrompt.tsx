"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Flag, SearchX } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { getLegacyQuestHashId, questHref } from "../quest-routes";
import { useQuestWorkspace } from "./QuestWorkspaceContext";

function PaneMessage({ icon, children }: { icon: ReactNode; children: ReactNode }) {
    return (
        <div className="flex min-h-[420px] flex-1 items-center justify-center border-t border-highlight/10 bg-[radial-gradient(circle_at_50%_45%,color-mix(in_oklab,_var(--highlight)_2.5%,_transparent),transparent_45%)] p-8 text-center">
            <div className="max-w-xs">
                <span className="mx-auto mb-4 flex justify-center text-subtle-foreground">{icon}</span>
                {children}
            </div>
        </div>
    );
}

/** `/quests` detail outlet. Also translates legacy `#quest-<id>` links, which never reach the server. */
export function QuestSelectionPrompt() {
    const router = useRouter();
    useEffect(() => {
        const questId = getLegacyQuestHashId(window.location.hash);
        if (questId) router.replace(questHref(questId), { scroll: false });
    }, [router]);

    return (
        <PaneMessage icon={<Flag size={24} />}>
            <p className="text-sm text-subtle-foreground">Select a quest from the log to inspect its objectives, requirements, and progression links.</p>
        </PaneMessage>
    );
}

export function QuestDetailLoading() {
    return (
        <div role="status" className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
            <span className="mr-3 inline-block size-4 animate-spin rounded-full border-2 border-highlight/10 border-t-brand motion-reduce:animate-none" aria-hidden="true" />
            Loading quest…
        </div>
    );
}

export function QuestNotFound({ message = "This quest does not exist in the current game mode's quest data." }: { message?: string }) {
    const { indexHref } = useQuestWorkspace();
    return (
        <PaneMessage icon={<SearchX size={24} />}>
            <h1 className="text-sm font-semibold text-foreground">Quest not found</h1>
            <p className="mt-2 text-sm text-subtle-foreground">{message}</p>
            <Link href={indexHref} className={buttonClassName({ className: "mt-5" })}>Back to quests</Link>
        </PaneMessage>
    );
}
