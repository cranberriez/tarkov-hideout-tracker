"use client";

import { cn } from "@/lib/utils";

interface MarketStatBoxProps {
    label: string;
    value: string;
    labelClassName?: string;
}

export function MarketStatBox({ label, value, labelClassName }: MarketStatBoxProps) {
    return (
        <div className="bg-card p-2 sm:p-3 border-l-2 border-border-color flex flex-col min-w-0">
            <span className={cn("text-xs text-muted-foreground uppercase tracking-wider", labelClassName)}>
                {label}
            </span>
            <span className="mt-1 text-sm sm:text-lg font-mono font-medium text-foreground truncate">
                {value}
            </span>
        </div>
    );
}
