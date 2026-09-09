"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface FilterNumberInputProps {
    label?: string;
    value: number;
    onCommit: (value: number) => void;
    widthClassName: string;
    prefix?: React.ReactNode;
    suffix?: React.ReactNode;
    disabled?: boolean;
    onInteract?: () => void;
}

export function FilterNumberInput({
    label,
    value,
    onCommit,
    widthClassName,
    prefix,
    suffix,
    disabled = false,
    onInteract,
}: FilterNumberInputProps) {
    const [draftValue, setDraftValue] = useState(String(value));

    useEffect(() => {
        setDraftValue(String(value));
    }, [value]);

    const commit = () => {
        const trimmed = draftValue.trim();
        if (trimmed === "") {
            setDraftValue(String(value));
            return;
        }

        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed)) {
            setDraftValue(String(value));
            return;
        }

        const nextValue = Math.max(0, Math.floor(parsed));
        onCommit(nextValue);
        setDraftValue(String(nextValue));
    };

    return (
        <div
            className={cn(
                "flex items-center gap-1 rounded-sm border border-highlight/10 bg-shadow/30 px-2 py-1 text-xs text-muted-foreground",
                disabled && "opacity-50",
            )}
        >
            {prefix}
            <input
                type="text"
                aria-label={label}
                inputMode="numeric"
                value={draftValue}
                disabled={disabled}
                onChange={(event) => setDraftValue(event.target.value)}
                onFocus={onInteract}
                onBlur={commit}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.currentTarget.blur();
                    }
                }}
                className={cn(
                    widthClassName,
                    "border-b border-border bg-transparent text-right font-mono text-foreground focus:border-brand focus:outline-none",
                )}
            />
            {suffix}
        </div>
    );
}
