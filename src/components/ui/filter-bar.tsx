"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function FilterBar({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn("flex flex-wrap gap-1.5 rounded-md border bg-muted px-3 py-2", className)}
            {...props}
        />
    );
}

const buttonClass = (active: boolean) =>
    cn(
        "flex items-center justify-center gap-2 rounded-sm border px-3 py-2 text-xs font-medium transition-all focus-visible:outline-2 focus-visible:outline-tarkov-green",
        active
            ? "border-tarkov-green bg-tarkov-green/10 text-tarkov-green"
            : "border-white/10 bg-black/20 text-gray-400 hover:border-white/30 hover:bg-black/40",
    );

export function FilterToggle({
    checked,
    onCheckedChange,
    className,
    ...props
}: Omit<ComponentProps<"button">, "onChange"> & {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <button
            {...props}
            type="button"
            aria-pressed={checked}
            onClick={() => onCheckedChange(!checked)}
            className={cn(buttonClass(checked), className)}
        />
    );
}

export function FilterPanelButton({
    open,
    panelId,
    className,
    ...props
}: ComponentProps<"button"> & { open: boolean; panelId: string }) {
    return (
        <button
            {...props}
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            className={cn(buttonClass(open), className)}
        />
    );
}

/** Place beside page content inside a relatively positioned container. */
export function FilterPanel({
    open,
    className,
    ...props
}: ComponentProps<"div"> & { open: boolean }) {
    return (
        <div
            {...props}
            aria-hidden={!open}
            inert={!open}
            className={cn(
                "absolute left-0 top-0 z-45 w-full max-w-[340px] transition-all duration-200 ease-out motion-reduce:transition-none",
                open
                    ? "pointer-events-auto translate-x-0 opacity-100"
                    : "pointer-events-none -translate-x-4 opacity-0",
                className,
            )}
        />
    );
}

export function FilterSearchInput({
    value,
    onValueChange,
    label,
    className,
    ...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "size"> & {
    value: string;
    onValueChange: (value: string) => void;
    label: string;
}) {
    return (
        <div
            className={cn(
                "flex min-w-[140px] flex-1 items-center gap-2 rounded-sm border border-white/10 bg-black/40 px-3 focus-within:border-tarkov-green",
                className,
            )}
        >
            <Search size={14} className="shrink-0 text-gray-500" aria-hidden="true" />
            <input
                {...props}
                type="search"
                aria-label={label}
                value={value}
                onChange={(event) => onValueChange(event.target.value)}
                className="min-w-0 flex-1 bg-transparent py-2 text-xs text-white outline-none placeholder:text-gray-500 [&::-webkit-search-cancel-button]:appearance-none"
            />
            {value && (
                <button
                    type="button"
                    aria-label={`Clear ${label.toLowerCase()}`}
                    onClick={() => onValueChange("")}
                    className="text-gray-400 hover:text-white focus-visible:outline-2 focus-visible:outline-tarkov-green"
                >
                    <X size={14} />
                </button>
            )}
        </div>
    );
}

/** Native radios supply single selection and keyboard arrow navigation. */
export function FilterRadioGroup<T extends string>({
    label,
    value,
    onValueChange,
    options,
    className,
}: {
    label: string;
    value: T;
    onValueChange: (value: T) => void;
    options: readonly { value: T; label: string; icon?: ReactNode }[];
    className?: string;
}) {
    const name = useId();
    return (
        <div
            role="radiogroup"
            aria-label={label}
            className={cn("flex rounded-sm border border-white/10 bg-black/40 p-1", className)}
        >
            {options.map((option) => (
                <label
                    key={option.value}
                    title={option.label}
                    className="relative flex flex-1 cursor-pointer"
                >
                    <input
                        type="radio"
                        name={name}
                        value={option.value}
                        checked={value === option.value}
                        onChange={() => onValueChange(option.value)}
                        className="peer sr-only"
                        aria-label={option.label}
                    />
                    <span
                        className={cn(
                            "flex flex-1 items-center justify-center gap-1.5 rounded-xs px-2.5 py-1 text-xs font-medium transition-all peer-focus-visible:outline-2 peer-focus-visible:outline-tarkov-green",
                            value === option.value
                                ? "bg-tarkov-green text-black shadow-sm"
                                : "text-gray-400 hover:bg-white/5 hover:text-white",
                        )}
                    >
                        {option.icon ?? option.label}
                    </span>
                </label>
            ))}
        </div>
    );
}

export function FilterSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-3 py-1">
            <h3 className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{title}</h3>
            {children}
        </section>
    );
}
