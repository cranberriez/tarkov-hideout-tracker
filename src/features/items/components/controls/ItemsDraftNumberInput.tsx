"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ItemsDraftNumberInputProps {
    value: number;
    onCommit: (value: number) => void;
    widthClassName: string;
    prefix?: React.ReactNode;
    suffix?: React.ReactNode;
    disabled?: boolean;
    onInteract?: () => void;
}

export function ItemsDraftNumberInput({
    value,
    onCommit,
    widthClassName,
    prefix,
    suffix,
    disabled = false,
    onInteract,
}: ItemsDraftNumberInputProps) {
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
                "flex items-center gap-1 rounded-sm border border-white/10 bg-black/30 px-2 py-1 text-xs text-gray-400",
                disabled && "opacity-50",
            )}
        >
            {prefix}
            <input
                type="text"
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
                    "border-b border-gray-600 bg-transparent text-right font-mono text-white focus:border-tarkov-green focus:outline-none",
                )}
            />
            {suffix}
        </div>
    );
}
