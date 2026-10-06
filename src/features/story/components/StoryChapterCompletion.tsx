"use client";

import { useState } from "react";
import { Check, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STORY_DECISIONS } from "@/lib/data/story";
import type { StoryChapter } from "@/types/story";
import {
	canUndoChapterCompletion,
	chapterCompletionState,
	completeStoryChapter,
	undoChapterCompletion,
	type ChapterCompletionUndo,
} from "../chapter-completion";
import type { ChapterView } from "../story-model";
import type { StoryProgress } from "../story-progress";

export function StoryChapterCompletion({
	chapter,
	view,
	progress,
	update,
}: {
	chapter: StoryChapter;
	view: ChapterView;
	progress: StoryProgress;
	update: (transform: (current: StoryProgress) => StoryProgress) => void;
}) {
	const [undo, setUndo] = useState<ChapterCompletionUndo | null>(null);
	const state = chapterCompletionState(view);
	const canUndo = undo && canUndoChapterCompletion(progress, undo);
	const complete = () => {
		let receipt: ChapterCompletionUndo | null = null;
		update((current) => {
			const result = completeStoryChapter(current, chapter, STORY_DECISIONS);
			receipt = result.undo;
			return result.progress;
		});
		setUndo(receipt);
	};
	const undoComplete = () => {
		if (!undo) return;
		update((current) => undoChapterCompletion(current, undo));
		setUndo(null);
	};
	return (
		<div className="mt-3">
			<div className="flex gap-1.5">
				<Button
					variant="solid"
					size="md"
					className="min-w-0 flex-1 rounded-md border-0 bg-muted-foreground text-inverse duration-150 hover:bg-brand disabled:bg-surface-raised disabled:text-muted-foreground disabled:opacity-100 disabled:hover:bg-surface-raised motion-reduce:transition-none"
					disabled={!state.canComplete}
					aria-describedby={state.needsChoices ? "chapter-completion-hint" : undefined}
					onClick={complete}
				>
					{state.complete && <Check aria-hidden="true" className="size-4" />}
					{state.complete ? "Chapter complete" : "Complete chapter"}
				</Button>
				{canUndo && (
					<Button
						variant="ghost"
						size="md"
						iconOnly
						className="rounded-md border-0 bg-surface-raised hover:bg-surface-raised"
						aria-label="Undo chapter completion"
						title="Undo chapter completion"
						onClick={undoComplete}
					>
						<Undo2 aria-hidden="true" className="size-4" />
					</Button>
				)}
			</div>
			{state.needsChoices && (
				<p id="chapter-completion-hint" className="mt-2 text-xs text-muted-foreground">
					Resolve your route choices to complete this chapter.
				</p>
			)}
		</div>
	);
}
