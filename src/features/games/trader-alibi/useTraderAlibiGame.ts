"use client";

import { useCallback, useEffect, useState } from "react";
import { useBestScore } from "../useBestScore";
import {
	CLUE_KINDS,
	MAX_QUESTIONS,
	drawClue,
	pickTrader,
	questionPoints,
	unusedClues,
	type ClueKind,
	type TraderClue,
	type TraderCluePools,
} from "./trader-alibi-model";

/** Global best score, shared by every profile and mode; outside backups and resets. */
export const TRADER_ALIBI_STORAGE_KEY = "tarkov-trader-alibi-v1";
const NEXT_ROUND_MS = 2200;

export type TraderAlibiPhase = "ask" | "guess" | "correct" | "over";

/** The round's conversation in order: each asked clue and each trader guessed. */
export type TraderAlibiEntry = TraderClue | { kind: "guess"; traderId: string };

export interface TraderAlibiRound {
	run: number;
	round: number;
	traderId: string;
	log: TraderAlibiEntry[];
	used: ReadonlySet<string>;
	eliminated: ReadonlySet<string>;
	phase: TraderAlibiPhase;
	score: number;
	/** Points the last correct guess earned. */
	earned: number;
	/** Picks this round's flavour lines. */
	seed: number;
}

let runCounter = 0;

function newRound(
	pools: TraderCluePools,
	previous: Pick<TraderAlibiRound, "run" | "round" | "traderId" | "score"> | null,
): TraderAlibiRound | null {
	const traderId = pickTrader(pools, previous?.traderId ?? null);
	if (!traderId) return null;
	if (!previous) runCounter += 1;
	return {
		run: previous?.run ?? runCounter,
		round: (previous?.round ?? 0) + 1,
		traderId,
		log: [],
		used: new Set(),
		eliminated: new Set(),
		phase: "ask",
		score: previous?.score ?? 0,
		earned: 0,
		seed: Math.floor(Math.random() * 2 ** 31),
	};
}

/** One run: ask for a clue, guess the trader, and keep going until a round runs out of questions. */
export function useTraderAlibiGame(pools: TraderCluePools) {
	const [round, setRound] = useState<TraderAlibiRound | null>(() => newRound(pools, null));
	const [bestScore, recordBest] = useBestScore(TRADER_ALIBI_STORAGE_KEY);
	const [bestBeforeRun, setBestBeforeRun] = useState(bestScore);

	const availableKinds: ClueKind[] = round
		? CLUE_KINDS.filter((kind) => unusedClues(pools, round.traderId, kind, round.used).length > 0)
		: [];
	const questionsLeft = round ? MAX_QUESTIONS - round.eliminated.size : 0;
	// A trader can run out of clues before the question limit; the player may then guess without one.
	const canGuess = round?.phase === "guess" || (round?.phase === "ask" && availableKinds.length === 0);

	const ask = useCallback(
		(kind: ClueKind) => {
			if (!round || round.phase !== "ask") return;
			const drawn = drawClue(pools, round.traderId, kind, round.used);
			if (!drawn) return;
			setRound({
				...round,
				log: [...round.log, drawn.clue],
				used: new Set([...round.used, drawn.key]),
				phase: "guess",
			});
		},
		[pools, round],
	);

	const guess = useCallback(
		(traderId: string) => {
			if (!round || !canGuess || round.eliminated.has(traderId)) return;
			const log: TraderAlibiEntry[] = [...round.log, { kind: "guess", traderId }];
			if (traderId === round.traderId) {
				const clues = round.log.filter((entry) => entry.kind !== "guess").length;
				const earned = questionPoints(Math.max(1, clues));
				const score = round.score + earned;
				recordBest(score);
				setRound({ ...round, log, phase: "correct", score, earned });
				return;
			}
			const eliminated = new Set([...round.eliminated, traderId]);
			// Each wrong guess spends a question, including guesses made after the clues ran out.
			const outOfQuestions = eliminated.size >= MAX_QUESTIONS;
			setRound({ ...round, log, eliminated, phase: outOfQuestions ? "over" : "ask" });
		},
		[round, canGuess, recordBest],
	);

	const restart = useCallback(() => {
		setBestBeforeRun(bestScore);
		setRound(newRound(pools, null));
	}, [pools, bestScore]);

	useEffect(() => {
		if (round?.phase !== "correct") return;
		const timer = setTimeout(() => setRound(newRound(pools, round)), NEXT_ROUND_MS);
		return () => clearTimeout(timer);
	}, [round, pools]);

	return {
		round,
		availableKinds,
		questionsLeft,
		canGuess,
		bestScore: Math.max(bestScore, round?.score ?? 0),
		bestBeforeRun,
		ask,
		guess,
		restart,
	};
}
