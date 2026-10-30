"use client";

import { useModeRoute } from "@/lib/useModeRoute";
import { Footer } from "./Footer";

export function RouteAwareFooter() {
	const { path: pathname } = useModeRoute();
	if (
		pathname === "/uploader" ||
		pathname === "/quests" ||
		pathname.startsWith("/quests/") ||
		pathname.startsWith("/games/") ||
		pathname.startsWith("/maps/")
	)
		return null;
	return <Footer />;
}
