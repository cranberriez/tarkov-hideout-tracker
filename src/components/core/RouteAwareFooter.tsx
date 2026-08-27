"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./Footer";

export function RouteAwareFooter() {
    const pathname = usePathname();
    if (pathname === "/quests" || pathname.startsWith("/quests/")) return null;
    return <Footer />;
}
