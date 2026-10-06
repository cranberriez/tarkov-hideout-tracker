import type { StoryChapter, StoryChapterRef } from "@/types/story";
import { THE_TICKET } from "./the-ticket";

export { STORY_DECISION_BY_ID, STORY_DECISIONS, STORY_ENDING_BY_ID, STORY_ENDINGS } from "./endings";

/** Chapters with tracked data. */
export const STORY_CHAPTERS: readonly StoryChapter[] = [THE_TICKET];

const wiki = (page: string) => `https://escapefromtarkov.fandom.com/wiki/${page}`;

/** Every story chapter in the game, so references to untracked chapters can still link. */
export const STORY_CHAPTER_REFS: readonly StoryChapterRef[] = [
	{ id: "tour", name: "Tour", wikiLink: wiki("Tour") },
	{ id: "falling-skies", name: "Falling Skies", wikiLink: wiki("Falling_Skies") },
	{ id: "accidental-witness", name: "Accidental Witness", wikiLink: wiki("Accidental_Witness") },
	{ id: "batya", name: "Batya", wikiLink: wiki("Batya") },
	{ id: "blue-fire", name: "Blue Fire", wikiLink: wiki("Blue_Fire") },
	{ id: "boreas", name: "Boreas", wikiLink: wiki("Boreas") },
	{ id: "the-labyrinth", name: "The Labyrinth", wikiLink: wiki("The_Labyrinth_(story_chapter)") },
	{ id: "the-unheard", name: "The Unheard", wikiLink: wiki("The_Unheard") },
	{ id: "they-are-already-here", name: "They Are Already Here", wikiLink: wiki("They_Are_Already_Here") },
	{ id: "the-ticket", name: "The Ticket", wikiLink: wiki("The_Ticket") },
];

export function findStoryChapter(id: string): StoryChapter | undefined {
	return STORY_CHAPTERS.find((chapter) => chapter.id === id);
}

export function findStoryChapterRef(id: string): StoryChapterRef | undefined {
	return STORY_CHAPTER_REFS.find((chapter) => chapter.id === id);
}

/** Every chapter has a page; untracked ones show a placeholder with the wiki link. */
export function storyChapterLink(id: string): { name: string; href: string } | null {
	const ref = findStoryChapterRef(id);
	return ref ? { name: ref.name, href: `/story/${id}` } : null;
}
