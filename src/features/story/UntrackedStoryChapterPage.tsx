import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
import type { StoryChapterRef } from "@/types/story";

/** Placeholder so cross-chapter links always have an internal target. */
export function UntrackedStoryChapterPage({ chapter }: { chapter: StoryChapterRef }) {
	return (
		<main className="container mx-auto flex-1 px-4 py-6 sm:px-6">
			<Link
				href="/story"
				className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
			>
				<ChevronLeft aria-hidden="true" className="size-4" />
				Story chapters
			</Link>
			<div className="rounded-md border border-highlight/10 bg-card p-6">
				<h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{chapter.name}</h1>
				<p className="mt-2 text-sm text-muted-foreground">This chapter isn&apos;t tracked yet.</p>
				<a
					href={chapter.wikiLink}
					target="_blank"
					rel="noreferrer"
					className="mt-4 inline-flex items-center gap-1 text-sm text-brand hover:underline"
				>
					Read it on the wiki
					<ExternalLink aria-hidden="true" className="size-3.5" />
				</a>
			</div>
		</main>
	);
}
