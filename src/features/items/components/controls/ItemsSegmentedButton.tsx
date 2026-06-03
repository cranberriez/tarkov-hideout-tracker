"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ItemsSegmentedButtonProps {
    active: boolean;
    onClick: () => void;
    children?: ReactNode;
    icon?: ReactNode;
    grow?: boolean;
}

export function ItemsSegmentedButton({
    active,
    onClick,
    children,
    icon,
    grow = false,
}: ItemsSegmentedButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex items-center justify-center gap-1.5 rounded-xs px-2.5 py-1 text-xs font-medium transition-all",
                grow && "flex-1",
                active
                    ? "bg-tarkov-green text-black shadow-sm"
                    : "text-gray-400 hover:bg-white/5 hover:text-white",
            )}
        >
            {icon}
            {children}
        </button>
    );
}
