"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./Footer";
import type { DataStatusConfig } from "./DataStatusDialog";

export function RouteAwareFooter({ statusConfig }: { statusConfig: DataStatusConfig }) {
    const pathname = usePathname();
    if (pathname === "/quests" || pathname.startsWith("/quests/")) return null;
    return <Footer statusConfig={statusConfig} />;
}
