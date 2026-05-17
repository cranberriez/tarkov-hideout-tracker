"use client";

import { cn } from "@/lib/utils";

interface QuestFlagFiltersProps {
    showKappa: boolean;
    showLightkeeper: boolean;
    onToggleKappa: () => void;
    onToggleLightkeeper: () => void;
    expand?: boolean;
    className?: string;
}

export function QuestFlagFilters({
    showKappa,
    showLightkeeper,
    onToggleKappa,
    onToggleLightkeeper,
    expand = false,
    className,
}: QuestFlagFiltersProps) {
    return (
        <div className={cn("flex items-center gap-2", expand && "w-full", className)}>
            <QuestFlagButton
                label="Kappa"
                active={showKappa}
                onClick={onToggleKappa}
                expand={expand}
                activeClassName="border-yellow-500/70 bg-yellow-500/80 text-black"
                inactiveClassName="border-yellow-500/20 bg-yellow-500/10 text-yellow-500/80 hover:border-yellow-500/35 hover:bg-yellow-500/15"
            />
            <QuestFlagButton
                label="Lightkeeper"
                active={showLightkeeper}
                onClick={onToggleLightkeeper}
                expand={expand}
                activeClassName="border-teal-400/70 bg-teal-400/80 text-black"
                inactiveClassName="border-teal-400/20 bg-teal-400/10 text-teal-400/80 hover:border-teal-400/35 hover:bg-teal-400/15"
            />
        </div>
    );
}

function QuestFlagButton({
    label,
    active,
    onClick,
    expand,
    activeClassName,
    inactiveClassName,
}: {
    label: string;
    active: boolean;
    onClick: () => void;
    expand: boolean;
    activeClassName: string;
    inactiveClassName: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "inline-flex h-8 items-center justify-center rounded-sm border px-3 text-xs font-medium leading-none transition-all",
                expand && "flex-1",
                active ? activeClassName : inactiveClassName,
            )}
        >
            {label}
        </button>
    );
}
