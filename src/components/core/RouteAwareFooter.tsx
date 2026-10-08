"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./Footer";

export function RouteAwareFooter() {
	const pathname = usePathname();
	if (
		pathname === "/uploader" ||
		pathname === "/quests" ||
		pathname.startsWith("/quests/") ||
		pathname.startsWith("/games/")
	)
		return null;
	return <Footer />;
}
