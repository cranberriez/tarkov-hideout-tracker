import type { StoryEndingId, StoryItemRef } from "@/types/story";

/**
 * Mr. Kerman's TerraGroup evidence, delivered in The Ticket and found across the
 * story chapters. `chapterId` is the chapter where each piece is found; that chapter's
 * steps are matched by item ID, or by name for items absent from the catalog.
 */

const item = (name: string, id?: string, extra: Pick<StoryItemRef, "chapterId" | "note"> = {}) => ({
	name,
	...(id ? { id } : {}),
	...extra,
});

/** Major evidence each ending needs delivered; other endings need none. */
export const MAJOR_EVIDENCE_REQUIRED: Readonly<Partial<Record<StoryEndingId, number>>> = { savior: 8, debtor: 2 };

export const MAJOR_EVIDENCE: readonly StoryItemRef[] = [
	item("Audio tape with incriminating evidence", "688897e094cca0a80b070aed", {
		chapterId: "accidental-witness",
		note: "Shoreline: in a flower bed at Kozlov's hideout.",
	}),
	item("Agent network deployment report", "68d3041818d70f97e704ad7b", {
		chapterId: "batya",
		note: "Lighthouse: on a red crate inside Lightkeeper's locked area.",
	}),
	item("Item 1156 specification", "689b52d6886e9848a4085917", {
		chapterId: "blue-fire",
		note: "Streets of Tarkov: needs the Rus Post car key.",
	}),
	item("Icebreaker archive data", "69bb45b89c92ecd910059159", {
		chapterId: "boreas",
		note: "Mailed once you help Mechanic decode the hard drives.",
	}),
	item("Labyrinth facility research report", "68d2fdbbf8817df4690db3d5", {
		chapterId: "the-labyrinth",
		note: "Shoreline: on the shore next to the pier.",
	}),
	item("Document mentioning the Warden", "689b5218533aa51a060f810a", {
		chapterId: "the-unheard",
		note: "Streets of Tarkov: needs the green A.P. apartment keycard and TerraGroup corporate apartment key.",
	}),
	item("Fuel catalyst test report", "689b5187665c386d9c007a43", {
		chapterId: "the-unheard",
		note: "Factory: TerraGroup storage room keycard room, multiple spawns.",
	}),
	item("ARRS system specifications", "689b53ef987b304021088e95", {
		chapterId: "they-are-already-here",
		note: "Mailed when the chapter is complete.",
	}),
	item("Transcript of conversation with Ms. A.", "689b4f5f6035689a0c0724ce", {
		note: "Streets of Tarkov: Cardinal apartment bedroom safe; needs a Labs Black keycard (no use consumed).",
	}),
];

const minor = (name: string, id: string | undefined, chapterId: string | undefined, note?: string) =>
	item(name, id, { ...(chapterId ? { chapterId } : {}), ...(note ? { note } : {}) });

export const MINOR_EVIDENCE: readonly StoryItemRef[] = [
	minor("FSB report", "68d301e75f98276b7503c332", "accidental-witness", "Streets of Tarkov: Zmeisky 3 apartment."),
	minor("Letter from Kozlov's room", "68d2fd018c12620073059934", "accidental-witness", "Customs: dorm room 110."),
	minor(
		"Letter from Reshala's bunkhouse",
		"68d2f4fc17b59ead010894b6",
		"accidental-witness",
		"Customs: Reshala's bunkhouse.",
	),
	minor(
		"Letter from the mailbox",
		"68d2fc914aae290cf704e373",
		"accidental-witness",
		"Streets of Tarkov: Chekannaya 13 mailbox.",
	),
	minor("Audio tape with report", "6888958794cca0a80b070ae9", "batya", "Interchange: Gnezdo Outpost."),
	minor("Bogatyr squad operations report", "68d302814aae290cf704e375", "batya", "Interchange: Gnezdo Outpost."),
	minor("Hostage evacuation report from Voevoda", "68d3037c91c2fa84e2044a0d", "batya", "Woods: Ryabina Outpost."),
	minor("Moreman's personnel file", "68d3054f0c834c20c00a81da", "batya", "Interchange: Gnezdo Outpost."),
	minor("Strelets' personnel file", "68d305fc8c12620073059936", "batya", "Interchange: Carousel Outpost."),
	minor("Taran's personnel file", "68d305c35f98276b7503c336", "batya", "Interchange: Carousel Outpost."),
	minor("Voevoda's personnel file", "68d3059318d70f97e704ad7f", "batya", "Interchange: Carousel Outpost."),
	minor(
		"Boreas scientist audio tape",
		"69bb4673d6c67f6265004aca",
		"boreas",
		"Icebreaker level 1 lab; needs the C-3 keycard.",
	),
	minor("Compartment C-1 access log", "69bb44cbd6c67f6265004ac1", "boreas", "Icebreaker level 7, by the C-1 door."),
	minor("Paradigm Shipping directive", "69bb4499957ebbdeb600393f", "boreas", "Lighthouse: freight yard warehouse."),
	minor(
		"Sailor's diary",
		"69bb4558b44453acde02ebe7",
		"boreas",
		"Icebreaker crew room 18; needs the crew quarters keycard.",
	),
	minor("Plane crew transcript", undefined, "falling-skies", "Shoreline."),
	minor(
		"Assistant's notes on Group #12",
		"68d2fa3abe7c1493b90cd3f9",
		"the-labyrinth",
		"Behind the observation room door.",
	),
	minor("Assistant's notes on Group #3 and Group #10", "68d2fac7c8305ec7c900296c", "the-labyrinth"),
	minor("Assistant's notes on Group #3", "68d2fa6d4aae290cf704e371", "the-labyrinth"),
	minor("Assistant's notes on Group #8", "68d2fa9b691b7c7b34046367", "the-labyrinth"),
	minor("Assistant's notes on TG-Vi-24 test subjects", "68d2faf191c2fa84e2044a0b", "the-labyrinth"),
	minor("Leshy's diary", "68d2fd582ca1a737d107b84f", "the-labyrinth", "By a dead PMC near the torture room."),
	minor("A.P. meeting audio tape Part 1", "68109c867807b4d2dd0b5df5", "the-unheard", "The Lab: Lecture Hall (R16)."),
	minor("A.P. meeting audio tape Part 2", "68889263ea36baf84d085540", "the-unheard", "The Lab: Lecture Hall (R16)."),
	minor("Cargo transport fax", "689b5108304455f61a0bc298", "the-unheard", "The Lab."),
	minor(
		"Copy of report for TG Worldwide",
		"689b52892c175da5bf083ba1",
		"the-unheard",
		"Streets of Tarkov: A.P.'s apartment.",
	),
	minor(
		"Document mentioning a protocol",
		"689b5256147eeab4410ecd14",
		"the-unheard",
		"Streets of Tarkov: A.P.'s apartment.",
	),
	minor("Document on changes in enterprise interactions", "689b50ec127673bbd40706d1", "the-unheard", "The Lab."),
	minor(
		"Hard drive printout",
		"689b512b075404ce7e09ec12",
		"the-unheard",
		"Intelligence Center craft from Rzhevsky's hard drive.",
	),
	minor(
		"Order from TerraGroup Worldwide headquarters",
		"6877c866ae5d3a06a30d7f3f",
		"the-unheard",
		"Streets of Tarkov: A.P.'s apartment.",
	),
	minor("Transport log with notes", "689b514c886e9848a4085915", "the-unheard", "Factory."),
	minor(
		"Book of the Arrival",
		"689b53222c175da5bf083ba3",
		"they-are-already-here",
		"Streets of Tarkov: cult victim's apartment.",
	),
	minor(
		"Cult victim audio tape #1",
		"6811e9119b009e592c07a59e",
		"they-are-already-here",
		"Streets of Tarkov: cult victim's apartment.",
	),
	minor("Cult victim audio tape #2", "688893c5a030f9346505e6d5", "they-are-already-here", "Lighthouse."),
	minor(
		"Note on preparations for the Arrival",
		"6877c834b52f568d4b0ea5a5",
		"they-are-already-here",
		"Streets of Tarkov: cult victim's apartment.",
	),
	minor(
		"Folder with intelligence on Norvinsk region facilities",
		"689b5072665c386d9c007a41",
		undefined,
		"The Lab: Kruglov's office (R22) safe; needs a Black keycard.",
	),
];
