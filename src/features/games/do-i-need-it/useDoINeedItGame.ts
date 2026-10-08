"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBestScore } from "../useBestScore";
import type { ItemSummary } from "@/types/items";
import type { ItemNeed } from "../../items/demand/item-demand-model";
import { buildNeedRound, type NeedRound } from "./do-i-need-it-model";

/** Global best streak, shared by every profile and mode; outside backups and resets. */
export const DO_I_NEED_IT_STORAGE_KEY = "tarkov-do-i-need-it-v1";
const NEXT_ROUND_MS = 1800;

export type DoINeedItPhase = "pick" | "correct" | "over" | "complete";

export interface DoINeedItState extends NeedRound {
	run: number;
	round: number;
	usedNeeded: ReadonlySet<string>;
	picked: string | null;
	phase: DoINeedItPhase;
	streak: number;
}

let runCounter = 0;

function startRun(catalog: readonly ItemSummary[], needs: ReadonlyMap<string, ItemNeed>): DoINeedItState | null {
	const round = buildNeedRound(catalog, needs, new Set(), 0);
	if (!round) return null;
	runCounter += 1;
	return { ...round, run: runCounter, round: 0, usedNeeded: new Set(round.needed), picked: null, phase: "pick", streak: 0 };
}

/** One run: pick a needed item each round; rounds shrink until a wrong pick ends the run. */
export function useDoINeedItGame(catalog: readonly ItemSummary[], needs: ReadonlyMap<string, ItemNeed>) {
	const [state, setState] = useState<DoINeedItState | null>(() => startRun(catalog, needs));
	const [bestStreak, recordBest] = useBestScore(DO_I_NEED_IT_STORAGE_KEY);
	const [bestBeforeRun, setBestBeforeRun] = useState(bestStreak);

	const pick = useCallback(
		(itemId: string) => {
			if (!state || state.phase !== "pick") return;
			if (!state.needed.has(itemId)) return setState({ ...state, picked: itemId, phase: "over" });
			const streak = state.streak + 1;
			recordBest(streak);
			setState({ ...state, picked: itemId, phase: "correct", streak });
		},
		[state, recordBest],
	);

	const restart = useCallback(() => {
		setBestBeforeRun(bestStreak);
		setState(startRun(catalog, needs));
	}, [catalog, needs, bestStreak]);

	useEffect(() => {
		if (state?.phase !== "correct") return;
		const timer = setTimeout(() => {
			const next = buildNeedRound(catalog, needs, state.usedNeeded, state.round + 1);
			if (!next) return setState({ ...state, phase: "complete" });
			setState({
				...state,
				...next,
				round: state.round + 1,
				usedNeeded: new Set([...state.usedNeeded, ...next.needed]),
				picked: null,
				phase: "pick",
			});
		}, NEXT_ROUND_MS);
		return () => clearTimeout(timer);
	}, [state, catalog, needs]);

	const neededCount = useMemo(() => state?.needed.size ?? 0, [state]);
	return {
		state,
		neededCount,
		bestStreak: Math.max(bestStreak, state?.streak ?? 0),
		bestBeforeRun,
		pick,
		restart,
	};
}
