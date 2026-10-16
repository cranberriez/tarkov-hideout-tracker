"use client";

import { useEffect, useRef } from "react";
import { QuestFilterBar, QuestTraderBar } from "./QuestFilterBar";
import { QuestListPane } from "./QuestListPane";
import { useQuestWorkspace } from "./QuestWorkspaceContext";

/** Browser-rendered list and controls; the persistent workspace owns their state. */
export function QuestListSurface() {
	const { selectedQuestId } = useQuestWorkspace();
	const initialQuestId = useRef(selectedQuestId);
	useEffect(() => {
		const questId = initialQuestId.current;
		if (!questId) return;
		// The dynamic list can mount after the workspace's initial effect has run.
		const frame = requestAnimationFrame(() =>
			document.getElementById(`quest-workspace-${questId}`)?.scrollIntoView({ block: "center" }),
		);
		return () => cancelAnimationFrame(frame);
	}, []);

	return (
		<>
			<QuestFilterBar />
			<QuestTraderBar />
			<QuestListPane />
		</>
	);
}
