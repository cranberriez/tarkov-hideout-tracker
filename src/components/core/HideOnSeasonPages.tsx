"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Season pages are standalone and data-less: they render their own top row, not the app shell. */
export const isSeasonPage = (pathname: string | null) => !!pathname && /^\/season-\d+(?:\/|$)/.test(pathname);

/** Last non-season path seen in this tab's client session; client navigations don't update document.referrer. */
let lastSitePath: string | null = null;
export const getLastSitePath = () => lastSitePath;

/** Skips its children (navbar, setup, stores, global modals) on the season pages. */
export function HideOnSeasonPages({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	useEffect(() => {
		if (!isSeasonPage(pathname)) lastSitePath = pathname;
	}, [pathname]);
	return isSeasonPage(pathname) ? null : children;
}
