/**
 * Hand-authored story chapter data. The provider has no story records, so chapters,
 * decisions and steps are reviewed against the wiki. Step and decision IDs are
 * persisted in player progress: never rename or reuse them.
 */

export type StoryEndingId = "savior" | "debtor" | "survivor" | "fallen";

export interface StoryEnding {
	id: StoryEndingId;
	name: string;
	image: string;
	summary: string;
}

/** Every chapter in the game, tracked or not, so cross-chapter references can link. */
export interface StoryChapterRef {
	id: string;
	name: string;
	wikiLink: string;
}

export interface StoryQuestRef {
	id: string;
	name: string;
}

/** A catalog item when `id` is present; name-only references are story items missing from the catalog. */
export interface StoryItemRef {
	id?: string;
	name: string;
	count?: number;
	/** Story chapter the item comes from, when it is found elsewhere. */
	chapterId?: string;
	/** Where to find it. */
	note?: string;
}

export interface StoryDecisionOption {
	id: string;
	label: string;
	description?: string;
	/** Endings still reachable after choosing this option. Omitted means every ending. */
	endings?: StoryEndingId[];
}

/** A dialogue choice or story outcome that changes the remaining route. */
export interface StoryDecision {
	id: string;
	prompt: string;
	/** Chapter where the choice is made; may differ from the chapter it affects. */
	chapterId: string;
	pointOfNoReturn?: boolean;
	/** Only relevant once this holds, e.g. a follow-up to an earlier choice. */
	when?: StoryCondition;
	options: StoryDecisionOption[];
}

export type StoryCondition =
	{ decision: string; is: string | string[] } | { all: StoryCondition[] } | { any: StoryCondition[] };

export interface StoryStep {
	id: string;
	text: string;
	optional?: boolean;
	map?: string;
	items?: StoryItemRef[];
	/** Short guide text shown with the step. */
	note?: string;
	/** Something that fails this route. */
	warning?: string;
	rewards?: string[];
	quests?: StoryQuestRef[];
	/** The step where this decision is made. */
	decision?: string;
	requiresLightkeeper?: boolean;
	when?: StoryCondition;
	/** Optional sub-objectives that help complete this step. */
	substeps?: StoryStep[];
}

export interface StorySection {
	id: string;
	title: string;
	/** Endings this route section belongs to, for display. Omitted means every ending. */
	endings?: StoryEndingId[];
	when?: StoryCondition;
	steps: StoryStep[];
}

export interface StoryChapter {
	id: string;
	name: string;
	wikiLink: string;
	banner: string;
	icon: string;
	summary: string;
	previousChapterIds: string[];
	/** Decisions referenced by this chapter, including ones made in earlier chapters. */
	decisionIds: string[];
	sections: StorySection[];
}
