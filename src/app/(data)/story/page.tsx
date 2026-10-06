import type { Metadata } from "next";
import { StoryIndexClientPage } from "@/features/story/StoryIndexClientPage";

export const metadata: Metadata = {
	title: "Escape from Tarkov Story Chapters & Endings Tracker",
	description:
		"Track Escape from Tarkov story chapters, choose an ending, record your choices, and see the steps and items left.",
	alternates: { canonical: "/story" },
};

export default function StoryPage() {
	return <StoryIndexClientPage />;
}
