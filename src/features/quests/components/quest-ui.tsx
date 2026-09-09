import { Settings2 } from "lucide-react";
import type { ReactNode } from "react";

export function SlidersIcon() {
    return <Settings2 size={18} />;
}

export function SidebarLabel({ children }: { children: ReactNode }) {
    return (
        <div className="flex items-center gap-1 px-2">
            <span className="text-[10px] uppercase tracking-wider text-subtle-foreground font-bold">
                {children}
            </span>
        </div>
    );
}

export function SidebarToggle({
    active,
    onClick,
    children,
    className = "",
}: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
    className?: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 w-full text-xs px-2 py-1.5 rounded-sm transition-all text-left border-l-2 ${
                active
                    ? "border-brand text-brand bg-brand/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-highlight/5"
            } ${className}`}
        >
            {children}
        </button>
    );
}

export function Divider() {
    return <div className="h-5 w-px bg-highlight/10 shrink-0" />;
}

export function SegGroup({ children }: { children: ReactNode }) {
    return (
        <div className="flex shrink-0 bg-shadow/40 rounded-sm p-1 border border-highlight/10">
            {children}
        </div>
    );
}

export function SegButton({
    active,
    onClick,
    children,
    title,
}: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
    title?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            title={title}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-xs transition-all ${
                active
                    ? "bg-brand text-inverse shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-highlight/5"
            }`}
        >
            {children}
        </button>
    );
}

export function FilterButton({
    active,
    disabled = false,
    onClick,
    label,
}: {
    active: boolean;
    disabled?: boolean;
    onClick: () => void;
    label: string;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-sm border transition-all cursor-pointer shrink-0 ${
                disabled
                    ? "border-highlight/5 text-subtle-foreground bg-shadow/10 cursor-not-allowed"
                    : active
                    ? "border-brand text-brand bg-brand/10 shadow-[0_0_10px_color-mix(in_oklab,_var(--brand)_10%,_transparent)]"
                    : "border-highlight/10 text-muted-foreground hover:border-highlight/30 bg-shadow/20 hover:bg-shadow/40"
            }`}
        >
            {label}
        </button>
    );
}
