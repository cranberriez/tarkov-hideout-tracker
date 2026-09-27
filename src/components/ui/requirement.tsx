import type { ReactNode } from "react";
import { CheckCircle2, Circle, Lock, LockOpen, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * `satisfied` is decided by the owning domain code: true = met, false = unmet,
 * null = unknown or not tracked (for example, an unsupported requirement type).
 */
export type RequirementState = boolean | null;

export function RequirementRow({
    satisfied,
    label,
    title,
    children,
    className,
}: {
    satisfied: RequirementState;
    label: ReactNode;
    title?: string;
    children: ReactNode;
    className?: string;
}) {
    const icon = satisfied === true
        ? <CheckCircle2 size={14} aria-label="Met" className="mt-[3px] shrink-0 text-success" />
        : satisfied === false
          ? <XCircle size={14} aria-label="Not met" className="mt-[3px] shrink-0 text-danger" />
          : <Circle size={14} aria-label="Not tracked" className="mt-[3px] shrink-0 text-subtle-foreground" />;
    return (
        <div title={title} className={cn("flex items-start gap-2 text-sm", className)}>
            {icon}
            <span className="min-w-0">
                <span className="mr-2 text-subtle-foreground">{label}</span>
                <span className={satisfied === false ? "text-danger/80" : "text-foreground"}>{children}</span>
            </span>
        </div>
    );
}

/** Compact inline requirement, used where rows would be too tall (station cards). */
export function RequirementChip({
    satisfied,
    icon,
    children,
    title,
    className,
}: {
    satisfied: RequirementState;
    /** Replaces the default lock indicator, for example with a trader or skill image. */
    icon?: ReactNode;
    children: ReactNode;
    title?: string;
    className?: string;
}) {
    const indicator = icon ?? (satisfied === true
        ? <LockOpen size={12} className="text-success" aria-label="Met" />
        : satisfied === false
          ? <Lock size={12} className="text-danger" aria-label="Not met" />
          : null);
    return (
        <span
            title={title}
            className={cn(
                "inline-flex items-center gap-2 rounded-sm border px-2 py-1 text-[10px] font-medium uppercase",
                satisfied === true
                    ? "border-success/20 bg-success-surface/20 text-success"
                    : satisfied === false
                      ? "border-danger/20 bg-danger-surface/20 text-danger"
                      : "border-highlight/10 bg-highlight/3 text-foreground",
                className,
            )}
        >
            {indicator}
            {children}
        </span>
    );
}
