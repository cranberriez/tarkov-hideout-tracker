"use client";

import { Check, FileSearch } from "lucide-react";
import { MAJOR_EVIDENCE, MAJOR_EVIDENCE_REQUIRED, STORY_ENDING_BY_ID } from "@/lib/data/story";
import { cn } from "@/lib/utils";
import type { StoryEndingId } from "@/types/story";
import type { EvidenceEntry } from "../story-model";
import { StoryItemChip } from "./StoryItemChip";

const REQUIRED = Object.entries(MAJOR_EVIDENCE_REQUIRED) as Array<[StoryEndingId, number]>;

function requirementText(targetEnding: StoryEndingId | null) {
	if (targetEnding) {
		const needed = MAJOR_EVIDENCE_REQUIRED[targetEnding];
		const { name } = STORY_ENDING_BY_ID[targetEnding];
		return needed
			? `${name} needs ${needed} of ${MAJOR_EVIDENCE.length} major evidence.`
			: `${name} needs no evidence.`;
	}
	const parts = REQUIRED.map(([ending, needed]) => `${STORY_ENDING_BY_ID[ending].name} ${needed}`);
	return `${parts.join(" and ")} of the ${MAJOR_EVIDENCE.length} major evidence are needed.`;
}

/** Mr. Kerman's evidence found in this chapter, against what the target ending needs. */
export function StoryEvidencePanel({
	entries,
	completed,
	targetEnding,
}: {
	entries: readonly EvidenceEntry[];
	completed: ReadonlySet<string>;
	targetEnding: StoryEndingId | null;
}) {
	const major = entries.filter((entry) => entry.kind === "major");
	const minor = entries.filter((entry) => entry.kind === "minor");
	const isFound = (entry: EvidenceEntry) => entry.stepId !== null && completed.has(entry.stepId);
	const needed = targetEnding ? (MAJOR_EVIDENCE_REQUIRED[targetEnding] ?? 0) : null;
	return (
		<section className="rounded-md border border-special/25 bg-card p-4">
			<h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-special uppercase">
				<FileSearch aria-hidden="true" className="size-3.5" />
				Evidence for Mr. Kerman
			</h2>
			<p className="mt-1 text-xs text-muted-foreground">{requirementText(targetEnding)} Delivered in The Ticket.</p>
			{major.length > 0 && (
				<ul className={cn("mt-3 flex flex-col gap-1.5", needed === 0 && "opacity-60")}>
					{major.map((entry) => (
						<li key={entry.item.id ?? entry.item.name} className="flex items-center gap-2">
							<StoryItemChip item={entry.item} size="xs" />
							<span className="min-w-0 flex-1 text-xs text-foreground">{entry.item.name}</span>
							{isFound(entry) && <Check aria-label="Found" className="size-3.5 shrink-0 text-success" />}
						</li>
					))}
				</ul>
			)}
			{minor.length > 0 && (
				<p className="mt-2 text-xs text-muted-foreground">
					{minor.filter(isFound).length} of {minor.length} optional minor evidence found.
				</p>
			)}
		</section>
	);
}
