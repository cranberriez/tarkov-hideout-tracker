import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findStoryChapter, STORY_CHAPTERS } from "@/lib/data/story";
import { StoryChapterClientPage } from "@/features/story/StoryChapterClientPage";

interface StoryChapterPageProps {
	params: Promise<{ chapterId: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
	return STORY_CHAPTERS.map((chapter) => ({ chapterId: chapter.id }));
}

export async function generateMetadata({ params }: StoryChapterPageProps): Promise<Metadata> {
	const chapter = findStoryChapter((await params).chapterId);
	if (!chapter) return {};
	return {
		title: `${chapter.name} Story Chapter Tracker`,
		description: `${chapter.summary} Track every step and choice for your target ending.`,
		alternates: { canonical: `/story/${chapter.id}` },
	};
}

export default async function StoryChapterPage({ params }: StoryChapterPageProps) {
	const { chapterId } = await params;
	if (!findStoryChapter(chapterId)) notFound();
	return <StoryChapterClientPage chapterId={chapterId} />;
}
