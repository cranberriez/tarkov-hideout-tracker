"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStoredProfitValue } from "@/features/profit-pages/useStoredProfitValue";
import type { HigherLowerItem } from "@/types/contracts";
import {
	createHigherLowerPool,
	isCorrectGuess,
	parseBestStreak,
	pickChallenger,
	pickStartItem,
	type HigherLowerGuess,
	type HigherLowerPool,
} from "./higher-lower-model";

/** Global best streak, shared by every profile and mode; outside backups and resets. */
export const HIGHER_LOWER_STORAGE_KEY = "tarkov-higher-lower-v1";

export const REVEAL_MS = 1200;
const RESULT_MS = 700;
/** A wrong answer stays on screen a little longer before the badge expands into Play again. */
const FAIL_HOLD_MS = 1000;
export const SLIDE_MS = 600;

export type HigherLowerPhase = "guess" | "reveal" | "result" | "slide" | "over";

export interface HigherLowerRound {
	baseline: HigherLowerItem;
	challenger: HigherLowerItem;
	/** Preselected (and preloaded) so the slide shows it immediately; null when the pool is exhausted. */
	upcoming: HigherLowerItem | null;
	streak: number;
	phase: HigherLowerPhase;
	correct: boolean | null;
	used: ReadonlySet<string>;
}

function prefersReducedMotion() {
	return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function newRound(pool: HigherLowerPool): HigherLowerRound | null {
	const baseline = pickStartItem(pool);
	if (!baseline) return null;
	const challenger = pickChallenger(pool, baseline, 0, new Set([baseline.id]));
	if (!challenger) return null;
	const used = new Set([baseline.id, challenger.id]);
	const upcoming = pickChallenger(pool, challenger, 1, used);
	if (upcoming) used.add(upcoming.id);
	return { baseline, challenger, upcoming, streak: 0, phase: "guess", correct: null, used };
}

/** Owns one run: guesses, reveal timing, slides between cards and the saved best streak. */
export function useHigherLowerGame(items: readonly HigherLowerItem[]) {
	const pool = useMemo(() => createHigherLowerPool(items), [items]);
	const [round, setRound] = useState<HigherLowerRound | null>(() => newRound(pool));
	const [rawBest, updateBest] = useStoredProfitValue(HIGHER_LOWER_STORAGE_KEY);
	const bestStreak = parseBestStreak(rawBest);
	/** Best streak when this run started, so matching it is not called a new best. */
	const [bestBeforeRun, setBestBeforeRun] = useState(bestStreak);

	const restart = useCallback(() => {
		setBestBeforeRun(bestStreak);
		setRound(newRound(pool));
	}, [pool, bestStreak]);

	const guess = useCallback((choice: HigherLowerGuess) => {
		setRound((current) =>
			current?.phase === "guess"
				? { ...current, phase: "reveal", correct: isCorrectGuess(current.baseline, current.challenger, choice) }
				: current,
		);
	}, []);

	useEffect(() => {
		if (!round) return;
		const reduced = prefersReducedMotion();
		let timer: ReturnType<typeof setTimeout> | undefined;
		if (round.phase === "reveal") {
			timer = setTimeout(() => setRound({ ...round, phase: "result" }), reduced ? 0 : REVEAL_MS);
		} else if (round.phase === "result") {
			timer = setTimeout(
				() => {
					if (!round.correct) return setRound({ ...round, phase: "over" });
					const streak = round.streak + 1;
					updateBest((raw) => JSON.stringify({ bestStreak: Math.max(parseBestStreak(raw), streak) }));
					// Running out of items ends the run on a correct answer, which only a very long streak can reach.
					setRound({ ...round, streak, phase: round.upcoming ? "slide" : "over" });
				},
				round.correct ? RESULT_MS : FAIL_HOLD_MS,
			);
		} else if (round.phase === "slide" && round.upcoming) {
			const upcoming = round.upcoming;
			timer = setTimeout(
				() => {
					const used = new Set(round.used);
					const next = pickChallenger(pool, upcoming, round.streak + 1, used);
					if (next) used.add(next.id);
					setRound({
						...round,
						baseline: round.challenger,
						challenger: upcoming,
						upcoming: next,
						phase: "guess",
						correct: null,
						used,
					});
				},
				reduced ? 0 : SLIDE_MS,
			);
		}
		return () => clearTimeout(timer);
	}, [round, pool, updateBest]);

	return { round, bestStreak: Math.max(bestStreak, round?.streak ?? 0), bestBeforeRun, guess, restart };
}
