"use client";

import { CircleSlash, Link2, Pin } from "lucide-react";

export function QuestsQuickGuide() {
    return (
        <div className="flex flex-wrap items-center gap-2 rounded-md p-3 text-xs text-subtle-foreground">
            <span className="inline-flex items-center gap-1">
                <Pin size={12} className="text-info" />
                Pin keeps a quest surfaced and easy to revisit.
            </span>
            <span className="inline-flex items-center gap-1">
                <CircleSlash size={12} className="text-danger" />
                Ignore hides side branches you do not want to track right now.
            </span>
            <span className="inline-flex items-center gap-1">
                <Link2 size={12} className="text-muted-foreground" />
                Links jump between prerequisites and follow-up quests.
            </span>
        </div>
    );
}
