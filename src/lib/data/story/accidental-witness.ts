import type { StoryChapter } from "@/types/story";
import { chapterImage, item } from "./helpers";

/**
 * Accidental Witness, reviewed against the EFT wiki on 2026-10-06. Items without an `id`
 * are story items absent from the item catalog. Step images are wiki screenshots.
 */

const image = chapterImage("accidental-witness");

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
					images: [
						image("accidental-witness-map", "Car location marked on the map"),
						image("accidental-witness-car", "The scribbled-on car"),
					],
				},
				{
					id: "kozlov-home",
					text: "Figure out where Kozlov lived",
					map: "Customs",
					note: "Room 110, first floor of the two-story dorms.",
					images: [
						image("customs-2-story-dorms-map", "Two-story dorms location marked on the map"),
						image("room-110-door", "The door to room 110"),
					],
				},
				{
					id: "read-door-note",
					text: "Read the note on Kozlov's door",
					map: "Customs",
					items: [item("Note for Kozlov", "68d2f09fb350a6169f04bea9")],
					note: "Below the room number. Must be found in raid.",
					images: [image("room-110-door", "The door to room 110, with the note on the wall")],
				},
				{
					id: "kozlov-involvement",
					text: "Find out what Kozlov was involved in",
					map: "Customs",
					items: [item("Letter from Kozlov's room", "68d2fd018c12620073059934"), KOZLOV_KEY],
					note: "Read the letter on the nightstand. Must be found in raid.",
					images: [image("letter-from-kozlovs-room-spawn", "The letter on the nightstand")],
					substeps: [
						{ id: "access-kozlov-room", text: "Access Kozlov's room", optional: true, items: [KOZLOV_KEY] },
						{
							id: "repair-shop-note",
							text: "Figure out where to get Kozlov's key",
							optional: true,
							items: [item("Note from the repair shop", "68d2f1318c12620073059930")],
							note: "On the kitchen wall next to room 110.",
							images: [image("accidental-witness-kozlov-optional-note", "The note on the kitchen wall")],
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
					images: [
						image("zmeevsky-3-apt-8-map", "Zmeisky 3 location marked on the map"),
						image("zmeevsky-3-building", "The Zmeisky 3 building with the entrance marked"),
						image("zmeevsky-3-door-2", "The apartment door"),
					],
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
					images: [
						image("fsb-report-spawn-1", "FSB report spawn 1: in a drawer below the TV"),
						image("fsb-report-spawn-2", "FSB report spawn 2: on the windowsill next to the TV"),
						image("the-ninth-circle-issue-14-spawn-1", "Issue #14 spawn 1: on the wall next to the kitchen door"),
						image("the-ninth-circle-issue-14-spawn-2", "Issue #14 spawn 2: on the right wall in the kitchen"),
						image(
							"the-ninth-circle-issue-19-spawn-1",
							"Issue #19 spawn 1: on the wall right of the living room entrance",
						),
						image("the-ninth-circle-issue-19-spawn-2", "Issue #19 spawn 2: on the wall next to the armchair"),
						image("tarkov-herald-summary-spawn-3", "Herald summary spawn 1: bottom of the shelf next to the TV"),
						image("tarkov-herald-summary-spawn-1", "Herald summary spawn 2: on the armchair"),
						image("tarkov-herald-summary-spawn-2", "Herald summary spawn 3: bottom of the bookshelf"),
					],
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
					images: [
						image("accidental-witness-anastasia-building-map", "Building location marked on the map"),
						image("accidental-witness-anastasia-building-entrance", "The building entrance"),
						image("accidental-witness-anastasia-apartment-door", "The door to apartment 7"),
					],
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
					images: [
						image("accidental-witness-anastasia-mailbox-note-1", "The newspaper"),
						image("accidental-witness-anastasia-mailbox-note-2", "The letter"),
					],
				},
				{
					id: "locate-pasha",
					text: "Locate courier Pasha",
					map: "Customs",
					note: "The ambush spot is next to the two-story dorms.",
					images: [
						image("accidental-witness-pasha-map", "Ambush spot marked on the map"),
						image("accidental-witness-pasha-location", "The ambush spot"),
					],
				},
				{
					id: "search-ambush-spot",
					text: "Search the ambush spot",
					map: "Customs",
					items: [item("Unsealed envelope", "68d2f4aff8817df4690db3d1")],
					note: "Next to the bicycle. Must be found in raid.",
					images: [image("accidental-witness-pasha-note", "The envelope")],
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
					images: [
						image("reshalas-bunkhouse-key-map", "Bunkhouse location marked on the map"),
						image("reshalas-bunkhouse", "The bunkhouse door"),
					],
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
					images: [
						image("accidental-witness-reshalas-stash-note-1", "First note on the left wall"),
						image("accidental-witness-reshalas-stash-note-2", "Second note on the stool"),
						image("accidental-witness-reshalas-stash-note-3", "Third note on the right wall"),
					],
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
					images: [
						image("accidental-witness-kozlovs-hideout-map", "Hideout location marked on the map"),
						image("accidental-witness-kozlovs-hideout-1", "The house from the street"),
						image("accidental-witness-kozlovs-hideout-2", "The house"),
					],
				},
				{
					id: "obtain-kozlov-evidence",
					text: "Locate and obtain Kozlov's evidence",
					map: "Shoreline",
					items: [item("Audio tape with incriminating evidence", "688897e094cca0a80b070aed")],
					note: "In the flower bed next to the entrance. Must be found in raid. The optional Newspaper clipping with a photo of Anastasia is on the floor inside.",
					rewards: ["64,000 EXP", '"Pay Your Debt" achievement'],
					images: [
						image("accidental-witness-kozlovs-hideout-tape-far", "The flower bed"),
						image("accidental-witness-kozlovs-hideout-tape-close", "The tape"),
						image(
							"accidental-witness-kozlovs-hideout-optional-photo",
							"The optional newspaper clipping on the floor inside",
						),
					],
				},
			],
		},
	],
};
