"use client";

import {
    Braces,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    Circle,
    CircleSlash,
    KeyRound,
    Lock,
    Pin,
    RotateCcw,
    XCircle,
    AlertTriangle,
} from "lucide-react";
import type { FullQuest } from "@/types/quests";
import { cn } from "@/lib/utils";
import { formatQuestTraderGate } from "@/lib/utils/quest-trader-gates";
import { hasDisplayQuestLevel } from "@/lib/utils/quest-display";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { questMetaChipBaseClass } from "./styles";
import type { QuestSortMetadata } from "./types";

interface QuestActionButtonProps {
    type: "pin" | "ignore";
    active: boolean;
    className?: string;
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function QuestActionButton({ type, active, className, onClick }: QuestActionButtonProps) {
    const isPin = type === "pin";
    const label = isPin
        ? active
            ? "Unpin quest"
            : "Pin quest"
        : active
          ? "Stop ignoring quest"
          : "Ignore quest";
    const activeClass = isPin
        ? "text-info bg-info/12 shadow-[0_0_18px_color-mix(in_oklab,_var(--info)_24%,_transparent)]"
        : "text-danger bg-danger/12 shadow-[0_0_18px_color-mix(in_oklab,_var(--danger)_18%,_transparent)]";
    const inactiveClass = isPin
        ? "text-subtle-foreground hover:text-info hover:bg-info/8"
        : "text-subtle-foreground hover:text-danger hover:bg-danger/8";
    const Icon = isPin ? Pin : CircleSlash;

    return (
        <button
            onClick={onClick}
            aria-label={label}
            className={cn(
                "shrink-0 rounded-md p-1.5 transition-all",
                active ? activeClass : inactiveClass,
                className,
            )}
            title={label}
        >
            <Icon
                size={16}
                className={
                    isPin && active ? "fill-current" : !isPin && active ? "stroke-[2.25]" : ""
                }
            />
        </button>
    );
}

interface QuestCardHeaderProps {
    quest: FullQuest;
    sortMetadata?: QuestSortMetadata | null;
    completed: boolean;
    failed: boolean;
    disabled: boolean;
    ignored: boolean;
    pinned: boolean;
    available: boolean;
    canFail: boolean;
    forceExpand: boolean;
    expanded: boolean;
    debugOpen: boolean;
    showDebugButton: boolean;
    completedRequirementCount: number;
    hasFailWarning: boolean;
    hasMutuallyExclusiveBranch: boolean;
    questHasRequiredKeys: boolean;
    onToggleExpanded: () => void;
    onToggleDebug: () => void;
    onToggleComplete: () => void;
    onFailQuest: () => void;
    onResetQuestStatus: () => void;
    onTogglePinned: () => void;
    onToggleIgnored: () => void;
}

export function QuestCardHeader({
    quest,
    sortMetadata,
    completed,
    failed,
    disabled,
    ignored,
    pinned,
    available,
    canFail,
    forceExpand,
    expanded,
    debugOpen,
    showDebugButton,
    completedRequirementCount,
    hasFailWarning,
    hasMutuallyExclusiveBranch,
    questHasRequiredKeys,
    onToggleExpanded,
    onToggleDebug,
    onToggleComplete,
    onFailQuest,
    onResetQuestStatus,
    onTogglePinned,
    onToggleIgnored,
}: QuestCardHeaderProps) {
    const showStatusChip = failed || disabled || ignored || !available;
    return (
        <div
            className={cn(
                "relative px-2.5 py-2.5 sm:px-3",
                !forceExpand && "cursor-pointer",
            )}
            onClick={() => {
                if (!forceExpand) onToggleExpanded();
            }}
        >
            <div className="relative z-10 flex w-full items-center gap-2 sm:gap-2.5">
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    if (!canFail) onToggleComplete();
                }}
                aria-label={
                    canFail
                        ? "Change quest status"
                        : completed
                          ? "Mark quest incomplete"
                          : "Mark quest complete"
                }
                className="group relative -my-2.5 -ml-2.5 flex h-11 w-11 shrink-0 items-center justify-center cursor-pointer sm:-ml-3"
            >
                {canFail ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <span className="flex h-11 w-11 items-center justify-center">
                                {completed ? (
                                    <CheckCircle size={16} className="text-success" />
                                ) : failed ? (
                                    <XCircle size={16} className="text-danger" />
                                ) : (
                                    <Circle size={16} className="text-subtle-foreground" />
                                )}
                            </span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="start"
                            sideOffset={4}
                            className="border-border-color bg-card text-foreground"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <DropdownMenuItem
                                onSelect={onToggleComplete}
                                className="text-brand focus:text-brand"
                                disabled={completed}
                            >
                                <CheckCircle size={15} />
                                Complete
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onSelect={onFailQuest}
                                className="text-danger focus:text-danger"
                                disabled={failed}
                            >
                                <XCircle size={15} />
                                Failed
                            </DropdownMenuItem>
                            {(completed || failed) && (
                                <DropdownMenuItem
                                    onSelect={onResetQuestStatus}
                                    className="text-foreground focus:text-foreground"
                                >
                                    <RotateCcw size={15} />
                                    Unfinished
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <>
                        <Circle
                            size={16}
                            className={`absolute transition-opacity duration-200 text-subtle-foreground ${
                                completed ? "opacity-0" : "opacity-100 group-hover:opacity-0"
                            }`}
                        />
                        <CheckCircle
                            size={16}
                            className={`absolute transition-all duration-200 ${
                                completed
                                    ? "opacity-100 text-success"
                                    : "opacity-0 group-hover:opacity-100 text-subtle-foreground"
                            }`}
                        />
                    </>
                )}
            </button>

            {(quest.trader.image4xLink ?? quest.trader.imageLink) ? (
                <img
                    src={quest.trader.image4xLink ?? quest.trader.imageLink ?? ""}
                    alt={quest.trader.name}
                    className="h-6 w-6 shrink-0 rounded-full object-cover"
                />
            ) : (
                <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-highlight/10 text-[10px] text-muted-foreground"
                >
                    {quest.trader.name[0]}
                </div>
            )}

            <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <span
                    className={`min-w-0 text-sm font-medium leading-tight line-clamp-2 sm:truncate ${
                        completed
                            ? "text-subtle-foreground line-through"
                            : failed || disabled
                              ? "text-muted-foreground"
                              : "text-foreground"
                    }`}
                >
                    {quest.name}
                </span>
                {questHasRequiredKeys && (
                    <KeyRound
                        size={14}
                        className="shrink-0 text-warning/75"
                        role="img"
                        aria-label="Requires key"
                    />
                )}
                {showStatusChip && (
                    <span
                        className={`${questMetaChipBaseClass} hidden shrink-0 sm:inline-flex ${
                            failed || disabled
                                ? "text-danger bg-danger/10 border-danger/20"
                                : ignored
                                  ? "text-muted-foreground bg-shadow/50 border-highlight/10"
                                  : "border-transparent bg-transparent px-0 text-danger"
                        }`}
                    >
                        {failed ? (
                            "Failed"
                        ) : disabled ? (
                            "Disabled"
                        ) : ignored ? (
                            "Ignored"
                        ) : (
                            <Lock size={12} strokeWidth={2.25} aria-label="Locked" />
                        )}
                    </span>
                )}
            </div>

            {sortMetadata && (
                <span
                    className={`${questMetaChipBaseClass} hidden shrink-0 text-brand/80 bg-brand/10 border-brand/20 sm:inline-flex`}
                    title={sortMetadata.title}
                >
                    {sortMetadata.label}
                </span>
            )}

            <div className="hidden shrink-0 items-center gap-1 sm:flex">
                {quest.taskRequirements.length > 0 && (
                    <span
                        className={`${questMetaChipBaseClass} hidden text-muted-foreground bg-shadow/40 border-highlight/10 md:inline-flex`}
                        title={`${completedRequirementCount}/${quest.taskRequirements.length} prerequisite quests completed`}
                    >
                        {completedRequirementCount}/{quest.taskRequirements.length} reqs
                    </span>
                )}
                {hasFailWarning && (
                    <span
                        className={`${questMetaChipBaseClass} text-warning bg-warning/10 border-warning/20`}
                        title="This quest has non-branch fail conditions. Check the wiki before attempting it."
                    >
                        <AlertTriangle size={11} className="mr-1" />
                        Can fail
                    </span>
                )}
                {hasMutuallyExclusiveBranch && (
                    <span
                        className={`${questMetaChipBaseClass} text-special border-special/40`}
                        title="Mutually exclusive quest branch"
                    >
                        <AlertTriangle size={11} className="mr-1" />
                        Branch
                    </span>
                )}
                {hasDisplayQuestLevel(quest.minPlayerLevel) && (
                    <span
                        className={`${questMetaChipBaseClass} hidden text-muted-foreground bg-shadow/40 border-highlight/10 sm:inline-flex`}
                    >
                        Lv.{quest.minPlayerLevel}
                    </span>
                )}
                {quest.map && (
                    <span
                        className={`${questMetaChipBaseClass} hidden text-muted-foreground bg-shadow/40 border-highlight/10 sm:inline-flex`}
                    >
                        {quest.map.name}
                    </span>
                )}
                {quest.kappaRequired && (
                    <span
                        className={`${questMetaChipBaseClass} text-warning/80 bg-warning/10 border-warning/20`}
                        title="Required for Kappa"
                    >
                        {"\u03ba"}
                    </span>
                )}
                {quest.lightkeeperRequired && (
                    <span
                        className={`${questMetaChipBaseClass} text-info/80 bg-info/10 border-info/20`}
                        title="Required for Lightkeeper"
                    >
                        LK
                    </span>
                )}
                {(quest.factionName === "USEC" || quest.factionName === "BEAR") && (
                    <span
                        className={`${questMetaChipBaseClass} ${
                            quest.factionName === "USEC"
                                ? "text-info/80 bg-info/10 border-info/20"
                                : "text-danger/80 bg-danger/10 border-danger/20"
                        }`}
                    >
                        {quest.factionName}
                    </span>
                )}
                {quest.traderRequirements.map((req) => (
                    <span
                        key={req.id}
                        className={`${questMetaChipBaseClass} text-info/80 bg-info/10 border-info/20`}
                        title={formatQuestTraderGate(req)}
                    >
                        {formatQuestTraderGate(req)}
                    </span>
                ))}
                {quest.requiredPrestige && (
                    <span
                        className={`${questMetaChipBaseClass} text-special/80 bg-special/10 border-special/20`}
                        title={`Requires prestige ${quest.requiredPrestige.prestigeLevel}`}
                    >
                        P{quest.requiredPrestige.prestigeLevel}
                    </span>
                )}
            </div>

            {showDebugButton && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleDebug();
                    }}
                    aria-label={debugOpen ? "Hide raw quest data" : "Show raw quest data"}
                    className={`hidden shrink-0 transition-colors sm:inline-flex ${
                        debugOpen ? "text-warning" : "text-subtle-foreground hover:text-subtle-foreground"
                    }`}
                    title="Toggle raw JSON"
                >
                    <Braces size={13} />
                </button>
            )}

            <QuestActionButton
                type="pin"
                active={pinned}
                className="hidden sm:inline-flex"
                onClick={(e) => {
                    e.stopPropagation();
                    onTogglePinned();
                }}
            />
            <QuestActionButton
                type="ignore"
                active={ignored}
                className="hidden sm:inline-flex"
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleIgnored();
                }}
            />

            {!forceExpand &&
                (expanded ? (
                    <ChevronDown
                        size={14}
                        aria-label="Collapse quest details"
                        className="shrink-0 text-subtle-foreground"
                    />
                ) : (
                    <ChevronRight
                        size={14}
                        aria-label="Expand quest details"
                        className="shrink-0 text-subtle-foreground"
                    />
                ))}
            </div>
        </div>
    );
}
