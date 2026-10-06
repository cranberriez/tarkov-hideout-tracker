import type { StoryChapter, StoryItemRef } from "@/types/story";

/**
 * Accidental Witness, reviewed against the EFT wiki on 2026-10-06. Items without an `id`
 * are story items absent from the item catalog.
 */

const item = (name: string, id?: string, count?: number, extra: Pick<StoryItemRef, "chapterId" | "note"> = {}) => ({
	name,
	...(id ? { id } : {}),
	...(count ? { count } : {}),
	...extra,
});

const KOZLOV_KEY = item("Dorm room 110 key", "59136e1e86f774432f15d133");
const ZMEISKY_KEY = item("Zmeisky 3 apartment key", "68e960db934bf7b02d005dab");
const RESHALA_KEY = item("Reshala's bunkhouse key", "68e95f4fa4a577e907015787");

export const ACCIDENTAL_WITNESS: StoryChapter = {
	id: "accidental-witness",
	name: "Accidental Witness",
	wikiLink: "https://escapefromtarkov.fandom.com/wiki/Accidental_Witness",
	banner: "/images/story/accidental-witness/banner.webp",
	icon: "/images/story/accidental-witness/icon.webp",
	summary: "Follow a debtor's trail from the Customs dorms to his Shoreline hideout and recover the evidence he hid.",
	previousChapterIds: [],
	decisionIds: [],
	sections: [
		{
			id: "kozlov-room",
			title: "Investigate Kozlov's room",
			steps: [
				{
					id: "locate-car",
					text: "Locate the scribbled-on white car in the dorms courtyard",
					map: "Customs",
					note: "Starts the chapter.",
				},
				{
					id: "kozlov-home",
					text: "Figure out where Kozlov lived",
					map: "Customs",
					note: "Room 110, first floor of the two-story dorms.",
				},
				{
					id: "read-door-note",
					text: "Read the note on Kozlov's door",
					map: "Customs",
					items: [item("Note for Kozlov", "68d2f09fb350a6169f04bea9")],
					note: "Below the room number. Must be found in raid.",
				},
				{
					id: "kozlov-involvement",
					text: "Find out what Kozlov was involved in",
					map: "Customs",
					items: [item("Letter from Kozlov's room", "68d2fd018c12620073059934"), KOZLOV_KEY],
					note: "Read the letter on the nightstand. Must be found in raid.",
					substeps: [
						{ id: "access-kozlov-room", text: "Access Kozlov's room", optional: true, items: [KOZLOV_KEY] },
						{
							id: "repair-shop-note",
							text: "Figure out where to get Kozlov's key",
							optional: true,
							items: [item("Note from the repair shop", "68d2f1318c12620073059930")],
							note: "On the kitchen wall next to room 110.",
						},
						{ id: "investigate-kozlov-room", text: "Investigate Kozlov's room", optional: true },
					],
				},
			],
		},
		{
			id: "skier-accomplice",
			title: "Search Skier's accomplice's apartment",
			steps: [
				{
					id: "ask-traders-anastasia",
					text: "Ask the traders about Anastasia",
					note: "Ask Skier through the trader screen.",
				},
				{
					id: "access-accomplice-apartment",
					text: "Access Skier's accomplice's apartment",
					map: "Streets of Tarkov",
					items: [ZMEISKY_KEY],
					note: "First floor of Zmeisky 3; the entrance is on the backyard side.",
					substeps: [
						{ id: "find-zmeisky-key", text: "Find the key to the apartment", optional: true, items: [ZMEISKY_KEY] },
					],
				},
				{
					id: "learn-accomplice",
					text: "Learn more about Skier's accomplice",
					map: "Streets of Tarkov",
					substeps: [{ id: "investigate-accomplice-apartment", text: "Investigate the apartment", optional: true }],
				},
				{
					id: "read-accomplice-documents",
					text: "Read the documents in Skier's accomplice's apartment",
					map: "Streets of Tarkov",
					items: [
						item("FSB report", "68d301e75f98276b7503c332"),
						item("The Ninth Circle Issue #14", "68d2f400be7c1493b90cd3f7"),
						item("The Ninth Circle Issue #19", "68d2f44df63f06b7590ce30e"),
						item("Tarkov Herald summary", "68eaddac9b384b24740f91de"),
					],
					note: "Each has 2–3 spawns around the living room and kitchen. Must be found in raid.",
				},
				{
					id: "extract-streets",
					text: "Survive and extract from Streets of Tarkov",
					map: "Streets of Tarkov",
					note: 'A "Survived" or "Run-Through" extract counts.',
				},
				{ id: "report-skier-1", text: "Report to Skier" },
			],
		},
		{
			id: "anastasia",
			title: "Trace Anastasia and courier Pasha",
			steps: [
				{ id: "talk-ragman", text: "Talk to Ragman" },
				{
					id: "locate-anastasia-apartment",
					text: "Locate Anastasia's apartment",
					map: "Streets of Tarkov",
					note: "Apartment 7, second floor of Chekannaya 13.",
				},
				{ id: "learn-anastasia", text: "Learn more about Anastasia", map: "Streets of Tarkov" },
				{
					id: "investigate-anastasia-entrance",
					text: "Investigate the entrance of Anastasia's building",
					map: "Streets of Tarkov",
					items: [
						item("Letter from the mailbox", "68d2fc914aae290cf704e373"),
						item("Tarkov Herald newspaper with article by A. Mikhailova", "68d2f6352ca1a737d107b84b"),
					],
					note: "Both are in the mailbox downstairs. Must be found in raid.",
				},
				{
					id: "locate-pasha",
					text: "Locate courier Pasha",
					map: "Customs",
					note: "The ambush spot is next to the two-story dorms.",
				},
				{
					id: "search-ambush-spot",
					text: "Search the ambush spot",
					map: "Customs",
					items: [item("Unsealed envelope", "68d2f4aff8817df4690db3d1")],
					note: "Next to the bicycle. Must be found in raid.",
				},
				{ id: "talk-skier-2", text: "Talk to Skier" },
			],
		},
		{
			id: "reshala-bunkhouse",
			title: "Investigate Reshala's bunkhouse",
			steps: [
				{
					id: "locate-reshala-stash",
					text: "Locate Reshala's stash",
					map: "Customs",
					items: [RESHALA_KEY],
					note: "Reshala's bunkhouse.",
					substeps: [
						{ id: "neutralize-reshala", text: "Locate and neutralize Reshala", optional: true, map: "Customs" },
						{
							id: "obtain-reshala-key",
							text: "Obtain the key to Reshala's stash",
							optional: true,
							items: [RESHALA_KEY],
						},
					],
				},
				{
					id: "investigate-reshala-bunkhouse",
					text: "Investigate Reshala's bunkhouse",
					map: "Customs",
					items: [item("Note with an address", "68d2f3375f98276b7503c32e")],
					note: "Three notes: left wall, stool and right wall. Must be found in raid.",
					substeps: [
						{
							id: "reshala-work-notes",
							text: "Obtain Reshala's work notes",
							optional: true,
							items: [item("Note with a warning", "68d2f302be7c1493b90cd3f5")],
						},
						{
							id: "pasha-belongings",
							text: "Obtain courier Pasha's belongings",
							optional: true,
							items: [item("Letter from Reshala's bunkhouse", "68d2f4fc17b59ead010894b6")],
						},
					],
				},
			],
		},
		{
			id: "kozlov-hideout",
			title: "Recover Kozlov's evidence",
			steps: [
				{
					id: "locate-kozlov-hideout",
					text: "Locate Kozlov's hideout",
					map: "Shoreline",
					note: "House 3 in the eastern part of the west village.",
				},
				{
					id: "obtain-kozlov-evidence",
					text: "Locate and obtain Kozlov's evidence",
					map: "Shoreline",
					items: [item("Audio tape with incriminating evidence", "688897e094cca0a80b070aed")],
					note: "In the flower bed next to the entrance. Must be found in raid. The optional Newspaper clipping with a photo of Anastasia is on the floor inside.",
					rewards: ["64,000 EXP", '"Pay Your Debt" achievement'],
				},
			],
		},
	],
};
