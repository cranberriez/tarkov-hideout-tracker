import type { StoryImage, StoryItemRef } from "@/types/story";

/** A story item reference; omit `id` for story items absent from the item catalog. */
export const item = (
	name: string,
	id?: string,
	count?: number,
	extra: Pick<StoryItemRef, "chapterId" | "note"> = {},
): StoryItemRef => ({
	name,
	...(id ? { id } : {}),
	...(count ? { count } : {}),
	...extra,
});

/** Image factory for a chapter's wiki screenshots in `public/images/story/<chapterId>/steps/`. */
export const chapterImage =
	(chapterId: string) =>
	(file: string, caption: string): StoryImage => ({
		src: `/images/story/${chapterId}/steps/${file}.webp`,
		thumb: `/images/story/${chapterId}/steps/thumbs/${file}.webp`,
		caption,
	});
