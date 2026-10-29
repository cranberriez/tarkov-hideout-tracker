"use client";

import { useEffect, useState } from "react";
import { FIRST_SEASON_ID, getCurrentSeason, getSeason, type SeasonId } from "@/lib/cfg/seasons";

/** Availability only. Crossing a date never creates or changes a saved character. */
export function useCurrentSeason() {
	const [id, setId] = useState<SeasonId>(FIRST_SEASON_ID);
	useEffect(() => {
		const sync = () => setId(getCurrentSeason().id);
		sync();
		const timer = setInterval(sync, 30_000);
		window.addEventListener("focus", sync);
		document.addEventListener("visibilitychange", sync);
		return () => {
			clearInterval(timer);
			window.removeEventListener("focus", sync);
			document.removeEventListener("visibilitychange", sync);
		};
	}, []);
	return getSeason(id);
}
