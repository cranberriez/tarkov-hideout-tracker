import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuestGroupHeader({ label, count, collapsed, onClick, image, nested = false }: {
    label: string;
    count: number;
    collapsed: boolean;
    onClick: () => void;
    image?: string | null;
    nested?: boolean;
}) {
    return (
        <button
            type="button"
            aria-expanded={!collapsed}
            onClick={onClick}
            className={cn(
                "flex w-full cursor-pointer items-center gap-2 border-b border-white/8 bg-[#0f1012] px-3 text-left text-[9px] font-semibold uppercase tracking-[0.16em] text-gray-500 transition-colors hover:bg-white/[0.045] hover:text-gray-300",
                nested ? "h-7 pl-7" : "h-8",
            )}
        >
            {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            {image && <img src={image} alt="" className="h-4 w-4 rounded-full object-cover grayscale-[20%]" />}
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <span className="font-mono font-normal tracking-normal text-gray-600">{count}</span>
        </button>
    );
}
