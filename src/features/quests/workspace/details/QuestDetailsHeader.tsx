"use client";

import { CheckCircle2, Eye, EyeOff, ExternalLink, GitBranch, Map as MapIcon, Pin, RotateCcw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import { questCanFail } from "@/lib/quests/quest-failures";
import { cn } from "@/lib/utils";
import type { FullQuest } from "@/types/quests";
import type { QuestBranchLine } from "../quest-branch-graph";
import type { QuestWorkspaceStatusInfo } from "../quest-workspace-utils";

/** Quest identity, status, and actions. Actions stay with the existing action owners via callbacks. */
export function QuestDetailsHeader({
    quest,
    status,
    traderImage,
    traderTabLabel,
    locationLabel,
    hasHeaderMetadata,
    essential,
    pinned,
    hidden,
    isCondensed,
    isCompactMapOpen,
    isDesktopMapOpen,
    hasObjectiveMap,
    visualizerLines,
    onToggleCompletion,
    onFail,
    onResetStatus,
    onTogglePinned,
    onToggleHidden,
    onShowMap,
    onShowDesktopMap,
    onOpenVisualizer,
}: {
    quest: FullQuest;
    status: QuestWorkspaceStatusInfo;
    traderImage?: string | null;
    traderTabLabel: string;
    locationLabel: string;
    hasHeaderMetadata: boolean;
    essential: boolean;
    pinned: boolean;
    hidden: boolean;
    isCondensed: boolean;
    isCompactMapOpen: boolean;
    isDesktopMapOpen: boolean;
    hasObjectiveMap: boolean;
    visualizerLines: QuestBranchLine[];
    onToggleCompletion: () => void;
    onFail: () => void;
    onResetStatus: () => void;
    onTogglePinned: () => void;
    onToggleHidden: () => void;
    onShowMap: () => void;
    onShowDesktopMap: () => void;
    onOpenVisualizer: (lineId: string) => void;
}) {
    return (
        <header className={cn(
            "relative z-40 shrink-0 overflow-visible border-b border-highlight/8 bg-[var(--surface-raised)] transition-[padding,min-height] duration-200 max-lg:absolute max-lg:inset-x-0 max-lg:top-0",
            isCondensed ? "min-h-0 px-4 py-2.5 sm:px-6" : "min-h-48 px-5 py-5 sm:px-7 sm:py-6",
            isCompactMapOpen && "max-lg:hidden",
        )}>
            {quest.taskImageLink && (
                <div
                    className={cn("pointer-events-none absolute inset-y-0 right-0 transition-opacity duration-200", isCondensed && "opacity-0")}
                    style={{ maskImage: "linear-gradient(to right, transparent 0%, var(--shadow) 24%, var(--shadow) 100%)" }}
                >
                    <img src={quest.taskImageLink} alt="" className="h-full w-auto max-w-none object-contain object-right opacity-55" />
                </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[var(--background)] via-[var(--background)]/88 to-transparent" />
            {hasObjectiveMap && !isDesktopMapOpen && (
                <Button
                    iconOnly
                    size="md"
                    onClick={onShowDesktopMap}
                    className="absolute right-3 top-3 z-10 hidden shadow-lg min-[1700px]:inline-flex"
                    aria-label="Show objective map"
                    title="Show objective map"
                >
                    <MapIcon size={16} />
                </Button>
            )}
            <div className={cn("relative", !isCondensed && "max-w-4xl sm:pr-10")}>
                <div className={cn("flex items-center gap-2.5 overflow-hidden transition-[height,margin,opacity] duration-200", isCondensed ? "h-0 opacity-0" : "mb-3 h-10 opacity-100")}>
                    {traderImage ? <img src={traderImage} alt="" className="h-9 w-9 rounded-full border border-highlight/10 object-cover" /> : null}
                    <div>
                        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-subtle-foreground">
                            {quest.trader.name}
                            <span className={essential ? "text-warning/75" : "text-brand/70"}>{traderTabLabel}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{locationLabel}</p>
                    </div>
                </div>
                <div className={cn(isCondensed && "flex flex-wrap items-center justify-between gap-2")}>
                    <div className="min-w-0">
                        <h1 className={cn("font-semibold tracking-tight text-foreground transition-[font-size] duration-200", isCondensed ? "truncate text-xl" : "text-3xl sm:text-4xl")}>{quest.name}</h1>
                        {hasHeaderMetadata && (
                            <div className={cn("flex flex-wrap items-center gap-x-2 overflow-hidden text-[11px] font-medium uppercase tracking-wider text-subtle-foreground transition-[height,margin,opacity] duration-200", isCondensed ? "h-0 opacity-0" : "mt-2 h-auto opacity-100")}>
                                {quest.requiredPrestige && <span>Prestige {quest.requiredPrestige.prestigeLevel}</span>}
                                {quest.requiredPrestige && (quest.kappaRequired || quest.lightkeeperRequired) && <span aria-hidden="true" className="text-subtle-foreground">·</span>}
                                {quest.kappaRequired && <span className="text-warning/75">Kappa required</span>}
                                {quest.kappaRequired && quest.lightkeeperRequired && <span aria-hidden="true" className="text-subtle-foreground">·</span>}
                                {quest.lightkeeperRequired && <span className="text-info/75">Lightkeeper required</span>}
                            </div>
                        )}
                    </div>
                    <div className={cn("flex flex-wrap gap-1.5", isCondensed ? "mt-0" : "mt-4")}>
                        <Badge size="md" tone={status.status === "locked" || status.status === "failed" ? "danger" : status.status === "completed" ? "success" : "info"} className={cn("h-8", isCondensed && "hidden")}>{status.label}</Badge>
                        <Button tone={status.status === "completed" ? "success" : "brand"} selected={status.status === "completed"} title={status.status === "completed" ? "Return this quest to an incomplete state" : "Mark this quest as completed"} onClick={onToggleCompletion}><CheckCircle2 size={14} />{status.status === "completed" ? "Mark incomplete" : "Mark complete"}</Button>
                        {questCanFail(quest) && !status.terminal && <Button tone="danger" title="Mark this quest as failed" onClick={onFail}><XCircle size={14} /> Mark failed</Button>}
                        {status.terminal === "failed" && <Button title="Clear the failed status" onClick={onResetStatus}><RotateCcw size={14} /> Reset status</Button>}
                        <Button tone={pinned ? "info" : "neutral"} selected={pinned} aria-pressed={pinned} title={pinned ? "Remove this quest from pinned quests" : "Keep this quest in pinned views"} onClick={onTogglePinned} className="hidden lg:inline-flex"><Pin size={14} className={pinned ? "fill-current" : ""} />{pinned ? "Unpin quest" : "Pin quest"}</Button>
                        <Button tone={hidden ? "special" : "neutral"} selected={hidden} aria-pressed={hidden} title={hidden ? "Restore this quest to normal filtered views" : "Hide this quest from normal filtered views"} onClick={onToggleHidden} className="hidden lg:inline-flex">{hidden ? <Eye size={14} /> : <EyeOff size={14} />}{hidden ? "Show quest" : "Hide quest"}</Button>
                        {hasObjectiveMap && <Button title="Show the objective map" onClick={onShowMap} className="min-[1700px]:hidden"><MapIcon size={14} /> Show map</Button>}
                        {visualizerLines.length === 1 && <Button tone="info" onClick={() => onOpenVisualizer(visualizerLines[0].id)}><GitBranch size={14} /> View quest line</Button>}
                        {visualizerLines.length > 1 && (
                            <details className="group relative">
                                <summary className={buttonClassName({ tone: "info", className: "list-none [&::-webkit-details-marker]:hidden" })}><GitBranch size={14} /> View quest line</summary>
                                <div className="absolute left-0 top-full z-[100] mt-1 min-w-56 rounded-sm border border-highlight/12 bg-[var(--card-bg)] p-1 shadow-2xl">
                                    {visualizerLines.map((line) => (
                                        <button
                                            key={line.id}
                                            type="button"
                                            onClick={(event) => {
                                                event.currentTarget.closest("details")?.removeAttribute("open");
                                                onOpenVisualizer(line.id);
                                            }}
                                            className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-highlight/8 hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"
                                        >
                                            <span className="min-w-0 flex-1 truncate">{line.name}</span>
                                            {line.kind === "special" && <Badge tone="warning" size="xs">Special</Badge>}
                                        </button>
                                    ))}
                                </div>
                            </details>
                        )}
                        {quest.wikiLink && <a href={quest.wikiLink} title="Open this quest on the Tarkov wiki" target="_blank" rel="noopener noreferrer" className={buttonClassName()}>Open wiki <ExternalLink size={12} /></a>}
                    </div>
                </div>
            </div>
        </header>
    );
}
