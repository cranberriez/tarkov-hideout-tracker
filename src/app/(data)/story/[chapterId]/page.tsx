import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findStoryChapter, findStoryChapterRef, STORY_CHAPTER_REFS } from "@/lib/data/story";
import { StoryChapterClientPage } from "@/features/story/StoryChapterClientPage";
import { UntrackedStoryChapterPage } from "@/features/story/UntrackedStoryChapterPage";

interface StoryChapterPageProps {
	params: Promise<{ chapterId: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
	return STORY_CHAPTER_REFS.map((chapter) => ({ chapterId: chapter.id }));
}

export async function generateMetadata({ params }: StoryChapterPageProps): Promise<Metadata> {
	const { chapterId } = await params;
	const chapter = findStoryChapter(chapterId);
	if (!chapter) {
		const ref = findStoryChapterRef(chapterId);
		// Placeholders stay out of search results until the chapter is tracked.
		return ref ? { title: `${ref.name} Story Chapter`, robots: { index: false } } : {};
	}
	return {
		title: `${chapter.name} Story Chapter Tracker`,
		description: `${chapter.summary} Track every step and choice for your target ending.`,
		alternates: { canonical: `/story/${chapter.id}` },
	};
}

export default async function StoryChapterPage({ params }: StoryChapterPageProps) {
	const { chapterId } = await params;
	if (findStoryChapter(chapterId)) return <StoryChapterClientPage chapterId={chapterId} />;
	const ref = findStoryChapterRef(chapterId);
	if (!ref) notFound();
	return <UntrackedStoryChapterPage chapter={ref} />;
}
