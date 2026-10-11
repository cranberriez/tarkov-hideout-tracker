"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { submitSiteRating } from "./actions";
import {
	COOKIE_MAX_AGE,
	RATING_PERSISTENCE_ENABLED,
	RESHOW_COOKIE,
	SUBMITTED_COOKIE,
	canShowRating,
	ratingCookieValues,
	readRatingCookies,
	safezoneLayout,
	type SiteRatingValue,
} from "./rating-model";

type Phase = "hidden" | "idle" | "loading" | "positive" | "negative" | "closing";

function writeCookies(success: boolean) {
	if (!RATING_PERSISTENCE_ENABLED) return;
	const values = ratingCookieValues(success);
	const options = `; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
	document.cookie = `${SUBMITTED_COOKIE}=${values.submitted}${options}`;
	document.cookie = `${RESHOW_COOKIE}=${values.reshowAt}${options}`;
}

export function useSiteRating() {
	const [phase, setPhase] = useState<Phase>("hidden");
	const [layout, setLayout] = useState<ReturnType<typeof safezoneLayout>>("collapsed");
	const [expanded, setExpanded] = useState(false);
	const [outcome, setOutcome] = useState<SiteRatingValue | null>(null);
	const busy = useRef(false);
	const dismissed = useRef(false);
	const mounted = useRef(false);
	const pathname = usePathname();

	useEffect(() => {
		mounted.current = true;
		let retryTimer: ReturnType<typeof setTimeout>;
		function checkCookies() {
			clearTimeout(retryTimer);
			if (busy.current) return;
			if (!RATING_PERSISTENCE_ENABLED) {
				if (!dismissed.current) setPhase("idle");
				return;
			}
			const saved = readRatingCookies(document.cookie);
			if (saved.submitted) {
				// Renew the browser's persistent-cookie lifetime on return visits.
				writeCookies(true);
				setPhase("hidden");
				return;
			}
			if (!canShowRating(document.cookie)) {
				setPhase("hidden");
				retryTimer = setTimeout(checkCookies, Math.min(saved.reshowAt - Date.now() + 1, 2_147_483_647));
			} else if (!dismissed.current || saved.reshowAt > 0) {
				dismissed.current = false;
				setPhase("idle");
			}
		}
		checkCookies();
		window.addEventListener("focus", checkCookies);
		return () => {
			mounted.current = false;
			clearTimeout(retryTimer);
			window.removeEventListener("focus", checkCookies);
		};
	}, [phase]);

	useEffect(() => {
		function measure() {
			const sides = document.querySelectorAll<HTMLElement>(".page-content:has(> main) > .page-content-side:last-child");
			const width = Math.max(0, ...Array.from(sides, (side) => side.getBoundingClientRect().width));
			setLayout(safezoneLayout(width));
		}
		const resize = new ResizeObserver(measure);
		resize.observe(document.body);
		// Route and Suspense replacements can change a main without resizing the body.
		const mutations = new MutationObserver(measure);
		mutations.observe(document.body, { childList: true, subtree: true });
		window.addEventListener("resize", measure);
		measure();
		return () => {
			resize.disconnect();
			mutations.disconnect();
			window.removeEventListener("resize", measure);
		};
	}, [pathname]);

	useEffect(() => {
		const delay = phase === "positive" ? 1800 : phase === "negative" ? 30_000 : phase === "closing" ? 250 : null;
		if (delay === null) return;
		const timer = setTimeout(() => {
			if (phase === "closing") {
				busy.current = false;
				dismissed.current = true;
				setPhase("hidden");
			} else setPhase("closing");
		}, delay);
		return () => clearTimeout(timer);
	}, [phase]);

	async function rate(value: SiteRatingValue) {
		if (busy.current || phase !== "idle") return;
		busy.current = true;
		setOutcome(value);
		setPhase("loading");
		const started = Date.now();
		try {
			const result = await submitSiteRating(value);
			// Also covers the browser's cookie state before the server rerender completes.
			writeCookies(result.success);
		} catch {
			// A dropped action response cannot set server cookies: persist the retry here.
			writeCookies(false);
		}
		await new Promise((resolve) => setTimeout(resolve, Math.max(0, 450 - (Date.now() - started))));
		if (mounted.current) setPhase(value === "good" ? "positive" : "negative");
	}

	return { phase, outcome, layout, expanded, setExpanded, rate, dismiss: () => setPhase("closing") };
}
