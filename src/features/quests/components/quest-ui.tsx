import { Settings2 } from "lucide-react";
import type { ReactNode } from "react";

export function SlidersIcon() {
    return <Settings2 size={18} />;
}

export function SidebarLabel({ children }: { children: ReactNode }) {
    return (
        <div className="flex items-center gap-1 px-2">
            <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">
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
                    ? "border-tarkov-green text-tarkov-green bg-tarkov-green/5"
                    : "border-transparent text-gray-400 hover:text-white hover:bg-white/5"
            } ${className}`}
        >
            {children}
        </button>
    );
}

export function Divider() {
    return <div className="h-5 w-px bg-white/10 shrink-0" />;
}

export function SegGroup({ children }: { children: ReactNode }) {
    return (
        <div className="flex shrink-0 bg-black/40 rounded-sm p-1 border border-white/10">
            {children}
        </div>
    );
}

export function SegButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-xs transition-all ${
                active
                    ? "bg-tarkov-green text-black shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
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
                    ? "border-white/5 text-gray-700 bg-black/10 cursor-not-allowed"
                    : active
                    ? "border-tarkov-green text-tarkov-green bg-tarkov-green/10 shadow-[0_0_10px_rgba(157,255,0,0.1)]"
                    : "border-white/10 text-gray-400 hover:border-white/30 bg-black/20 hover:bg-black/40"
            }`}
        >
            {label}
        </button>
    );
}
