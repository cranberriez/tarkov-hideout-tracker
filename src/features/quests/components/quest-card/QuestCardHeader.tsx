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
import type { FullQuest } from "@/types";
import { cn } from "@/lib/utils";
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
        ? "text-sky-300 bg-sky-500/12 shadow-[0_0_18px_rgba(56,189,248,0.24)]"
        : "text-red-300 bg-red-500/12 shadow-[0_0_18px_rgba(239,68,68,0.18)]";
    const inactiveClass = isPin
        ? "text-gray-500 hover:text-sky-300 hover:bg-sky-500/8"
        : "text-gray-500 hover:text-red-300 hover:bg-red-500/8";
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
                "flex items-center gap-2 px-2.5 py-2.5 sm:gap-2.5 sm:px-3",
                !forceExpand && "cursor-pointer",
            )}
            onClick={() => {
                if (!forceExpand) onToggleExpanded();
            }}
        >
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
                                    <CheckCircle size={16} className="text-tarkov-green" />
                                ) : failed ? (
                                    <XCircle size={16} className="text-red-300" />
                                ) : (
                                    <Circle size={16} className="text-gray-600" />
                                )}
                            </span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="start"
                            sideOffset={4}
                            className="border-border-color bg-card text-gray-200"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <DropdownMenuItem
                                onSelect={onToggleComplete}
                                className="text-tarkov-green focus:text-tarkov-green"
                                disabled={completed}
                            >
                                <CheckCircle size={15} />
                                Complete
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onSelect={onFailQuest}
                                className="text-red-300 focus:text-red-300"
                                disabled={failed}
                            >
                                <XCircle size={15} />
                                Failed
                            </DropdownMenuItem>
                            {(completed || failed) && (
                                <DropdownMenuItem
                                    onSelect={onResetQuestStatus}
                                    className="text-gray-300 focus:text-gray-100"
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
                            className={`absolute transition-opacity duration-200 text-gray-600 ${
                                completed ? "opacity-0" : "opacity-100 group-hover:opacity-0"
                            }`}
                        />
                        <CheckCircle
                            size={16}
                            className={`absolute transition-all duration-200 ${
                                completed
                                    ? "opacity-100 text-tarkov-green"
                                    : "opacity-0 group-hover:opacity-100 text-gray-500"
                            }`}
                        />
                    </>
                )}
            </button>

            {(quest.trader.image4xLink ?? quest.trader.imageLink) ? (
                <img
                    src={quest.trader.image4xLink ?? quest.trader.imageLink ?? ""}
                    alt={quest.trader.name}
                    className="w-6 h-6 rounded-full shrink-0 object-cover"
                />
            ) : (
                <div className="w-6 h-6 rounded-full shrink-0 bg-white/10 flex items-center justify-center text-[10px] text-gray-400">
                    {quest.trader.name[0]}
                </div>
            )}

            <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <span
                    className={`min-w-0 text-sm font-medium leading-tight line-clamp-2 sm:truncate ${
                        completed
                            ? "text-gray-600 line-through"
                            : failed || disabled
                              ? "text-gray-400"
                              : "text-white"
                    }`}
                >
                    {quest.name}
                </span>
                {questHasRequiredKeys && (
                    <KeyRound
                        size={14}
                        className="shrink-0 text-yellow-300/75"
                        role="img"
                        aria-label="Requires key"
                    />
                )}
                {showStatusChip && (
                    <span
                        className={`${questMetaChipBaseClass} hidden shrink-0 sm:inline-flex ${
                            failed || disabled
                                ? "text-red-300 bg-red-300/10 border-red-300/20"
                                : ignored
                                  ? "text-gray-400 bg-black/50 border-white/10"
                                  : "border-transparent bg-transparent px-0 text-red-300"
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
                    className={`${questMetaChipBaseClass} hidden shrink-0 text-tarkov-green/80 bg-tarkov-green/10 border-tarkov-green/20 sm:inline-flex`}
                    title={sortMetadata.title}
                >
                    {sortMetadata.label}
                </span>
            )}

            <div className="hidden shrink-0 items-center gap-1 sm:flex">
                {quest.taskRequirements.length > 0 && (
                    <span
                        className={`${questMetaChipBaseClass} hidden text-gray-400 bg-black/40 border-white/10 md:inline-flex`}
                        title={`${completedRequirementCount}/${quest.taskRequirements.length} prerequisite quests completed`}
                    >
                        {completedRequirementCount}/{quest.taskRequirements.length} reqs
                    </span>
                )}
                {hasFailWarning && (
                    <span
                        className={`${questMetaChipBaseClass} text-amber-300 bg-amber-500/10 border-amber-500/20`}
                        title="This quest has non-branch fail conditions. Check the wiki before attempting it."
                    >
                        <AlertTriangle size={11} className="mr-1" />
                        Can fail
                    </span>
                )}
                {hasMutuallyExclusiveBranch && (
                    <span
                        className={`${questMetaChipBaseClass} text-purple-300 border-purple-500/40`}
                        title="Mutually exclusive quest branch"
                    >
                        <AlertTriangle size={11} className="mr-1" />
                        Branch
                    </span>
                )}
                {quest.minPlayerLevel != null && (
                    <span
                        className={`${questMetaChipBaseClass} hidden text-gray-400 bg-black/40 border-white/10 sm:inline-flex`}
                    >
                        Lv.{quest.minPlayerLevel}
                    </span>
                )}
                {quest.map && (
                    <span
                        className={`${questMetaChipBaseClass} hidden text-gray-400 bg-black/40 border-white/10 sm:inline-flex`}
                    >
                        {quest.map.name}
                    </span>
                )}
                {quest.kappaRequired && (
                    <span
                        className={`${questMetaChipBaseClass} text-yellow-500/80 bg-yellow-500/10 border-yellow-500/20`}
                        title="Required for Kappa"
                    >
                        {"\u03ba"}
                    </span>
                )}
                {quest.lightkeeperRequired && (
                    <span
                        className={`${questMetaChipBaseClass} text-teal-400/80 bg-teal-400/10 border-teal-400/20`}
                        title="Required for Lightkeeper"
                    >
                        LK
                    </span>
                )}
                {(quest.factionName === "USEC" || quest.factionName === "BEAR") && (
                    <span
                        className={`${questMetaChipBaseClass} ${
                            quest.factionName === "USEC"
                                ? "text-blue-400/80 bg-blue-400/10 border-blue-400/20"
                                : "text-red-400/80 bg-red-400/10 border-red-400/20"
                        }`}
                    >
                        {quest.factionName}
                    </span>
                )}
                {quest.traderRequirements.map((req) => (
                    <span
                        key={req.id}
                        className={`${questMetaChipBaseClass} text-cyan-400/80 bg-cyan-400/10 border-cyan-400/20`}
                        title={`${req.trader.name} loyalty ${req.compareMethod} ${req.value}`}
                    >
                        {req.trader.name} LL{req.value}
                    </span>
                ))}
                {quest.requiredPrestige && (
                    <span
                        className={`${questMetaChipBaseClass} text-purple-400/80 bg-purple-400/10 border-purple-400/20`}
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
                        debugOpen ? "text-yellow-500" : "text-gray-700 hover:text-gray-500"
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
                        className="shrink-0 text-gray-500"
                    />
                ) : (
                    <ChevronRight
                        size={14}
                        aria-label="Expand quest details"
                        className="shrink-0 text-gray-500"
                    />
                ))}
        </div>
    );
}
