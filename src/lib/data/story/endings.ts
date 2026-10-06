import type { StoryDecision, StoryEnding, StoryEndingId } from "@/types/story";

export const STORY_ENDINGS: readonly StoryEnding[] = [
	{
		id: "savior",
		name: "Savior",
		image: "/images/story/endings/savior.webp",
		summary: "Help Mr. Kerman expose TerraGroup and deliver the major evidence.",
	},
	{
		id: "debtor",
		name: "Debtor",
		image: "/images/story/endings/debtor.webp",
		summary: "Stop feeding Mr. Kerman evidence and leave through Lightkeeper.",
	},
	{
		id: "survivor",
		name: "Survivor",
		image: "/images/story/endings/survivor.webp",
		summary: "Refuse Mr. Kerman and buy your way out through Prapor.",
	},
	{
		id: "fallen",
		name: "Fallen",
		image: "/images/story/endings/fallen.webp",
		summary: "Take Mr. Kerman's keycard help, then side with Prapor instead.",
	},
];

export const STORY_ENDING_BY_ID: Readonly<Record<StoryEndingId, StoryEnding>> = Object.fromEntries(
	STORY_ENDINGS.map((ending) => [ending.id, ending]),
) as Record<StoryEndingId, StoryEnding>;

/**
 * Decisions are global because a choice made in one chapter (for example the
 * Falling Skies armored case) changes the route of later chapters. IDs are persisted.
 */
export const STORY_DECISIONS: readonly StoryDecision[] = [
	{
		id: "falling-skies-armored-case",
		prompt: "What did you do with the armored case in Falling Skies?",
		chapterId: "falling-skies",
		pointOfNoReturn: true,
		options: [
			{
				id: "gave-prapor",
				label: "Gave it to Prapor",
				description: "You must recover the case through Lightkeeper. Survivor costs 300M roubles.",
			},
			{
				id: "kept",
				label: "Kept it",
				description: "Skip the recovery. Survivor costs 500M roubles plus Prapor's timed tasks.",
			},
		],
	},
	{
		id: "blue-fire-fragment",
		prompt: "Keep the fragment of Item 1156 or hand it over to Mechanic?",
		chapterId: "blue-fire",
		options: [
			{ id: "keep", label: "Keep it", description: 'Unlocks the "Better Served" achievement.' },
			{ id: "hand-over", label: "Hand it to Mechanic", description: "Pays 1,500,000 roubles." },
		],
	},
	{
		id: "ticket-kerman-offer",
		prompt: "Accept Mr. Kerman's offer to activate the keycard?",
		chapterId: "the-ticket",
		pointOfNoReturn: true,
		options: [
			{
				id: "accept",
				label: "Accept",
				endings: ["savior", "debtor", "fallen"],
				description: "Unlocks the Activated Kruglov's RFID keycard craft once you have the encryption device.",
			},
			{
				id: "refuse",
				label: "Refuse",
				endings: ["survivor"],
				description: "Unlocks the Activated Kruglov's RFID keycard craft; Prapor offers a paid way out.",
			},
		],
	},
	{
		id: "ticket-kerman-evidence",
		prompt: "Agree to find dirt on TerraGroup for Mr. Kerman?",
		chapterId: "the-ticket",
		pointOfNoReturn: true,
		when: { decision: "ticket-kerman-offer", is: "accept" },
		options: [
			{ id: "agree", label: "Agree", endings: ["savior", "debtor"], description: "Needs Intelligence Center level 3." },
			{
				id: "refuse",
				label: "Refuse",
				endings: ["fallen"],
				description: 'Unlocks the "Enough of Your Games!" achievement.',
			},
		],
	},
	{
		id: "ticket-major-evidence",
		prompt: "After handing in 2 major evidence, keep delivering?",
		chapterId: "the-ticket",
		pointOfNoReturn: true,
		when: { decision: "ticket-kerman-evidence", is: "agree" },
		options: [
			{
				id: "deliver-all",
				label: "Deliver all 8",
				endings: ["savior"],
				description: "Nine major evidence exist; any eight will do.",
			},
			{
				id: "stop-after-two",
				label: "Stop after 2",
				endings: ["debtor"],
				description: 'Unlocks To the Light - Getting Acquainted and the "U-Turn" achievement.',
			},
		],
	},
	{
		id: "they-are-already-here-evidence",
		prompt: "Did you receive the ARRS major evidence in They Are Already Here?",
		chapterId: "they-are-already-here",
		when: { decision: "ticket-kerman-evidence", is: "agree" },
		options: [
			{ id: "received", label: "Received it" },
			{ id: "missed", label: "Missed it", description: "Mr. Kerman gives you a second chance." },
		],
	},
	{
		id: "ticket-prapor-deadline",
		prompt: "Did you finish Prapor's tasks within 72 hours?",
		chapterId: "the-ticket",
		when: {
			all: [
				{ decision: "ticket-kerman-offer", is: "refuse" },
				{ decision: "falling-skies-armored-case", is: "kept" },
			],
		},
		options: [
			{ id: "in-time", label: "In time" },
			{ id: "missed", label: "Missed it", description: "Prapor also takes your Secure container Kappa." },
		],
	},
];

export const STORY_DECISION_BY_ID: Readonly<Record<string, StoryDecision>> = Object.fromEntries(
	STORY_DECISIONS.map((decision) => [decision.id, decision]),
);
