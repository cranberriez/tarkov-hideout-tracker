"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useModeRoute } from "@/lib/useModeRoute";

/**
 * A link to a mode-less path (`/hideout`, `itemPath(id)`) in the current game
 * mode: the URL's on mode-scoped pages, otherwise the active profile's. Usable
 * from server components, which cannot read the mode themselves.
 */
export function ModeLink({ href, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
	const { href: toModeHref } = useModeRoute();
	return <Link {...props} href={toModeHref(href)} />;
}
