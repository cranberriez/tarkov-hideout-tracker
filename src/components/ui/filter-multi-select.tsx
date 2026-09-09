"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterPanelButton } from "./filter-bar";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
} from "./dropdown-menu";

/** Consumers supply the trigger summary, rows, selection state, and domain rules. */
export function FilterMultiSelect({
    label,
    summary,
    children,
    className,
}: {
    label: string;
    summary: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const panelId = useId();
    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <FilterPanelButton
                    open={open}
                    panelId={panelId}
                    aria-label={label}
                    className={cn("min-w-0", className)}
                >
                    {summary}
                    <ChevronDown className="size-3.5 shrink-0" aria-hidden />
                </FilterPanelButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                id={panelId}
                aria-label={label}
                align="start"
                sideOffset={4}
                className="min-w-[var(--radix-dropdown-menu-trigger-width)] max-w-[calc(100vw-2rem)] bg-muted"
            >
                {children}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** The entire row toggles its checkbox and keeps the menu open for more choices. */
export function FilterMultiSelectItem({
    className,
    onSelect,
    ...props
}: ComponentProps<typeof DropdownMenuCheckboxItem>) {
    return (
        <DropdownMenuCheckboxItem
            {...props}
            className={cn("gap-2 text-xs", className)}
            onSelect={(event) => {
                onSelect?.(event);
                event.preventDefault();
            }}
        />
    );
}
