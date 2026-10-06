import Link from "next/link";
import { Check, FileSearch } from "lucide-react";
import { ItemThumbnail } from "@/components/entities/item-thumbnail";
import { findStoryChapterRef, MAJOR_EVIDENCE, MAJOR_EVIDENCE_REQUIRED, STORY_ENDING_BY_ID } from "@/lib/data/story";
import { cn } from "@/lib/utils";
import { isEvidenceFound, STORY_EVIDENCE } from "../story-evidence";
import type { StoryProgress } from "../story-progress";

const MAJOR_ENTRIES = STORY_EVIDENCE.filter((entry) => entry.kind === "major");

export function StoryEvidenceRow({ progress }: { progress: StoryProgress | null }) {
	const ending = progress?.targetEnding ? STORY_ENDING_BY_ID[progress.targetEnding] : null;
	const minorFound = STORY_EVIDENCE.filter(
		(entry) => entry.kind === "minor" && isEvidenceFound(entry, progress),
	).length;
	return (
		<section className="mt-8" aria-labelledby="story-evidence-heading">
			<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
				<h2 id="story-evidence-heading" className="flex items-center gap-2 text-sm font-semibold text-special">
					<FileSearch aria-hidden="true" className="size-4" />
					Evidence for Mr. Kerman
				</h2>
				{ending && (
					<p className="ml-auto text-right text-xs font-semibold text-special">
						{ending.name} needs {MAJOR_EVIDENCE_REQUIRED[ending.id] ?? 0} of {MAJOR_EVIDENCE.length} major evidence
					</p>
				)}
			</div>
			<ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{MAJOR_ENTRIES.map((entry) => {
					const { item, stepId } = entry;
					const found = isEvidenceFound(entry, progress);
					const chapter = item.chapterId ? findStoryChapterRef(item.chapterId) : null;
					const href = chapter && stepId ? `/story/${chapter.id}#step-${stepId}` : null;
					const className = cn(
						"flex h-full items-center gap-3 rounded-md border border-special/50 p-3",
						found ? "bg-special/20" : "bg-card",
						href &&
							"transition-colors hover:border-special hover:bg-special/10 focus-visible:outline-2 focus-visible:outline-special",
					);
					const content = (
						<>
							<ItemThumbnail item={item} size="md" />
							<div className="flex min-w-0 flex-1 flex-col gap-1">
								<span className="text-xs font-semibold text-foreground">{item.name}</span>
								<span className="text-xs text-muted-foreground">{chapter?.name ?? "Outside story chapters"}</span>
								<span className="mt-auto flex items-center gap-1 text-xs text-special">
									{found && <Check aria-hidden="true" className="size-3" />}
									{!progress ? "Loading progress…" : found ? "Found" : !href ? "No tracked objective" : "Not found"}
								</span>
							</div>
						</>
					);
					return (
						<li key={item.id ?? item.name} className="min-w-0" title={item.note}>
							{href ? (
								<Link href={href} className={className}>
									{content}
								</Link>
							) : (
								<div className={className}>{content}</div>
							)}
						</li>
					);
				})}
			</ul>
			<p className="mt-3 text-xs text-muted-foreground">
				{progress ? `${minorFound} minor evidence found` : "Loading minor evidence progress…"}
			</p>
		</section>
	);
}
