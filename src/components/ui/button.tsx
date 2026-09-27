import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared control vocabulary. Tones map to the documented palette roles: `brand`
 * for primary/selection, status roles for their semantic actions, and `neutral`
 * for everything else. Links reuse the same classes through `buttonClassName`.
 */
export type ButtonTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "special";
export type ButtonVariant = "solid" | "soft" | "ghost";
export type ButtonSize = "xs" | "sm" | "md";

export interface ButtonStyleOptions {
    tone?: ButtonTone;
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Square control sized to the height of `size`. */
    iconOnly?: boolean;
    /** Persistent selected/pressed appearance, independent of hover. */
    selected?: boolean;
    className?: string;
}

const base =
    "inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-1.5 rounded-sm border font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40";

const sizes: Record<ButtonSize, string> = {
    xs: "h-7 px-2 text-[11px]",
    sm: "h-8 px-2.5 text-xs",
    md: "h-9 px-3.5 text-sm",
};

const iconSizes: Record<ButtonSize, string> = {
    xs: "size-7",
    sm: "size-8",
    md: "size-9",
};

const soft: Record<ButtonTone, string> = {
    neutral: "border-highlight/15 bg-surface-raised text-muted-foreground hover:border-highlight/30 hover:text-foreground",
    brand: "border-brand/35 bg-accent text-brand hover:border-brand/65",
    success: "border-success/35 bg-success-surface text-success hover:border-success/65",
    warning: "border-warning/35 bg-warning-surface text-warning hover:border-warning/65",
    danger: "border-danger/35 bg-danger-surface text-danger hover:border-danger/65",
    info: "border-info/30 bg-info-surface text-info hover:border-info/55",
    special: "border-special/30 bg-special-surface text-special hover:border-special/55",
};

const solid: Record<ButtonTone, string> = {
    neutral: "border-transparent bg-foreground text-inverse hover:bg-muted-foreground",
    brand: "border-transparent bg-brand text-inverse hover:bg-brand-hover",
    success: "border-transparent bg-success text-inverse hover:opacity-90",
    warning: "border-transparent bg-warning text-inverse hover:opacity-90",
    danger: "border-transparent bg-danger text-inverse hover:opacity-90",
    info: "border-transparent bg-info text-inverse hover:opacity-90",
    special: "border-transparent bg-special text-inverse hover:opacity-90",
};

const ghost: Record<ButtonTone, string> = {
    neutral: "border-transparent bg-transparent text-muted-foreground hover:bg-highlight/5 hover:text-foreground",
    brand: "border-transparent bg-transparent text-brand hover:bg-brand/10",
    success: "border-transparent bg-transparent text-success hover:bg-success/10",
    warning: "border-transparent bg-transparent text-warning hover:bg-warning/10",
    danger: "border-transparent bg-transparent text-danger hover:bg-danger/10",
    info: "border-transparent bg-transparent text-info hover:bg-info/10",
    special: "border-transparent bg-transparent text-special hover:bg-special/10",
};

/** Selected neutral controls use brand, matching the filter kit. */
const selectedClasses: Record<ButtonTone, string> = {
    neutral: "border-brand bg-brand/10 text-brand hover:border-brand hover:text-brand",
    brand: "border-brand bg-brand/15 text-brand",
    success: "border-success/70 bg-success/15 text-success",
    warning: "border-warning/70 bg-warning/15 text-warning",
    danger: "border-danger/70 bg-danger/15 text-danger",
    info: "border-info/60 bg-info/15 text-info",
    special: "border-special/60 bg-special/15 text-special",
};

export function buttonClassName({
    tone = "neutral",
    variant = "soft",
    size = "sm",
    iconOnly = false,
    selected = false,
    className,
}: ButtonStyleOptions = {}) {
    const palette = variant === "solid" ? solid : variant === "ghost" ? ghost : soft;
    return cn(
        base,
        iconOnly ? cn(iconSizes[size], "px-0") : sizes[size],
        selected ? selectedClasses[tone] : palette[tone],
        className,
    );
}

export type ButtonProps = ComponentProps<"button"> & Omit<ButtonStyleOptions, "className">;

export function Button({
    tone,
    variant,
    size,
    iconOnly,
    selected,
    className,
    type = "button",
    ...props
}: ButtonProps) {
    return (
        <button
            {...props}
            type={type}
            className={buttonClassName({ tone, variant, size, iconOnly, selected, className })}
        />
    );
}
