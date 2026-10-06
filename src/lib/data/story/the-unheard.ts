import type { StoryChapter, StoryItemRef } from "@/types/story";

/**
 * The Unheard, reviewed against the EFT wiki on 2026-10-06. Items without an `id`
 * are story items absent from the item catalog.
 */

const item = (name: string, id?: string, count?: number, extra: Pick<StoryItemRef, "chapterId" | "note"> = {}) => ({
	name,
	...(id ? { id } : {}),
	...(count ? { count } : {}),
	...extra,
});

const RZHEVSKY_DRIVE = item("Hard drive from Rzhevsky's car");
const AP_FLASH_DRIVE = item("Sliderkey flash drive marked with A.P.");
const AP_DECRYPTED_DRIVE = item("Decrypted Sliderkey flash drive marked with A.P.");
const AP_APARTMENT_KEY = item("TerraGroup corporate apartment key", "67ee7680562d5057e60ccc3a");
const AP_GREEN_KEYCARD = item("Reprogrammed keycard for A.P.'s apartment lock (Green)", "68c14b734a7e0bada00f8fd4");

const IC_CRAFT_NOTE = "Craft at Intelligence Center level 1; the craft stops if power goes out.";

export const THE_UNHEARD: StoryChapter = {
	id: "the-unheard",
	name: "The Unheard",
	wikiLink: "https://escapefromtarkov.fandom.com/wiki/The_Unheard",
	banner: "/images/story/the-unheard/banner.webp",
	icon: "/images/story/the-unheard/icon.webp",
	summary:
		"Follow a TerraGroup note about The Unheard's purification to A.P.'s hidden room and learn how they are tied to Tarkov.",
	previousChapterIds: [],
	decisionIds: [],
	sections: [
		{
			id: "purification",
			title: "Investigate The Unheard",
			steps: [
				{
					id: "learn-unheard",
					text: "Learn more about The Unheard",
					items: [
						item("Note with ramblings about the Purification", "6877c87dd66d08f590036126"),
						item("TerraGroup science office key", "658199aa38c79576a2569e13"),
					],
					note: "Starts the chapter. Streets of Tarkov: TerraGroup security post surveillance room or the TerraGroup office. Ground Zero (level 21+): office 4 on the TerraGroup building's second floor, behind the science office key.",
				},
				{
					id: "learn-tg-activities",
					text: "Learn more about TerraGroup's activities",
					map: "The Lab",
					items: [item("Document on changes in enterprise interactions", "689b50ec127673bbd40706d1")],
					note: "In the laboratory next to the dome, first floor. Must be found in raid.",
				},
				{
					id: "learn-fuel",
					text: 'Learn more about the "fuel" mentioned in the note',
					map: "The Lab",
					items: [item("Cargo transport fax", "689b5108304455f61a0bc298")],
					note: "Office O23, second floor. Must be found in raid.",
				},
				{
					id: "catalyst-shipment",
					text: "Find more information about the special catalyst shipment",
					map: "Factory",
					items: [item("Transport log with notes", "689b514c886e9848a4085915")],
					note: "Must be found in raid.",
				},
			],
		},
		{
			id: "rzhevsky",
			title: "Recover Rzhevsky's data",
			steps: [
				{
					id: "rzhevsky-vehicle",
					text: "Locate Rzhevsky's service vehicle and obtain his personal belongings",
					map: "Streets of Tarkov",
					items: [RZHEVSKY_DRIVE],
					note: "On the center console of his car near the LexOs car dealership. Must be found in raid.",
				},
				{
					id: "retrieve-hard-drive-data",
					text: "Retrieve the data from the hard drive in Rzhevsky's car",
					items: [item("Hard drive printout", "689b512b075404ce7e09ec12")],
					note: IC_CRAFT_NOTE,
				},
				{
					id: "read-hard-drive-printout",
					text: "Read the transcript of Rzhevsky's conversation",
					note: "Read the printout from the quest inventory.",
				},
			],
		},
		{
			id: "factory-storage",
			title: "Search the Factory storage room",
			steps: [
				{
					id: "catalyst-test-report",
					text: "Locate and obtain the documents on the Blue Ice fuel catalyst research",
					map: "Factory",
					items: [
						item("Fuel catalyst test report", "689b5187665c386d9c007a43"),
						item("TerraGroup storage room keycard", "66acd6702b17692df20144c0"),
					],
					note: 'TerraGroup storage room in the tunnels next to the "Camera Bunker Door" Scav extract. Both documents have several spawns. Must be found in raid. The report is major evidence for Mr. Kerman in The Ticket.',
				},
				{
					id: "unheard-plans",
					text: "Find as much information as possible about the plans of The Unheard",
					map: "Factory",
					items: [item("Burnt document", "689b51de2c175da5bf083b9f")],
					note: "Same room. Must be found in raid.",
				},
			],
		},
		{
			id: "ap-lab",
			title: "Trace A.P. through The Lab",
			steps: [
				{
					id: "ap-activities",
					text: "Learn more about A.P.'s activities",
					map: "The Lab",
					items: [item("A.P. meeting audio tape Part 1", "68109c867807b4d2dd0b5df5")],
					note: "Must be found in raid.",
				},
				{
					id: "ap-role",
					text: "Learn more about A.P.'s role",
					map: "The Lab",
					items: [item("A.P. meeting audio tape Part 2", "68889263ea36baf84d085540")],
					note: "Must be found in raid.",
				},
				{
					id: "search-ap-lab",
					text: "Search for any mention of A.P. in The Lab",
					map: "The Lab",
					note: "Find one of the two whiteboards.",
				},
			],
		},
		{
			id: "health-resort",
			title: "Search A.P.'s Health Resort room",
			steps: [
				{
					id: "locate-ap-room",
					text: "Locate A.P.'s room in the Health Resort",
					map: "Shoreline",
					note: "East wing room 305.",
					substeps: [
						{
							id: "guard-post-note",
							text: "Find out which room A.P. was assigned to",
							optional: true,
							map: "Shoreline",
							items: [item("Guard post note", "689b51b2987b304021088e93")],
							note: "West wing first floor, on the desk by the security room at the southern entrance.",
						},
					],
				},
				{
					id: "ap-belongings",
					text: "Obtain A.P.'s personal belongings",
					map: "Shoreline",
					items: [AP_APARTMENT_KEY],
					note: "On the right nightstand. The optional Fragment of an unknown document is on the left one.",
				},
				{
					id: "ap-flash-drive",
					text: "Obtain A.P.'s data storage device",
					map: "Shoreline",
					items: [AP_FLASH_DRIVE],
					note: "In the laptop on the table. Must be found in raid.",
				},
			],
		},
		{
			id: "decrypt-drive",
			title: "Decrypt A.P.'s flash drive",
			steps: [
				{
					id: "decrypt-ap-drive",
					text: "Decrypt the flash drive from A.P.'s room",
					items: [AP_DECRYPTED_DRIVE],
					note: IC_CRAFT_NOTE,
				},
				{
					id: "ask-mechanic-help",
					text: "Ask Mechanic for help",
					note: "He can't help, but Elektronik can for a fee.",
				},
				{
					id: "handover-roubles-mechanic",
					text: "Hand over 5,000,000 roubles to Mechanic",
					items: [item("Roubles", "5449016a4bdc2d6f028b456f", 5_000_000)],
				},
				{ id: "handover-ap-drive", text: "Hand over the A.P. flash drive to Mechanic", items: [AP_DECRYPTED_DRIVE] },
				{
					id: "wait-elektronik",
					text: "Wait for the news from Elektronik",
					note: "Takes 6–12 hours, then talk to Mechanic. If you have already been in contact with Mr. Kerman, he reaches out after about 1.5 hours instead.",
				},
			],
		},
		{
			id: "ap-apartment",
			title: "Search A.P.'s apartment",
			steps: [
				{
					id: "integrate-ap-keycard",
					text: "Integrate the tech files from A.P.'s flash drive into a TerraGroup keycard",
					items: [AP_GREEN_KEYCARD],
					note: `${IC_CRAFT_NOTE} The blue and red keycards are false leads.`,
				},
				{
					id: "access-ap-apartment",
					text: "Access A.P.'s corporate apartment",
					map: "Streets of Tarkov",
					items: [AP_APARTMENT_KEY],
					note: "Apartment 1, second floor of the Cardinal apartment complex.",
				},
				{ id: "investigate-ap-apartment", text: "Investigate A.P.'s apartment", map: "Streets of Tarkov" },
				{
					id: "access-ap-hidden-room",
					text: "Access the hidden room in A.P.'s apartment",
					map: "Streets of Tarkov",
					items: [AP_GREEN_KEYCARD],
					note: "Down the hallway. The four documents below are inside; each must be found in raid.",
				},
				{
					id: "study-tg-documentation",
					text: "Study the TerraGroup documentation in A.P.'s office",
					items: [item("Order from TerraGroup Worldwide headquarters", "6877c866ae5d3a06a30d7f3f")],
				},
				{
					id: "study-blue-ice-role",
					text: "Study the role of the Blue Ice catalyst in The Unheard's protocol",
					items: [item("Copy of report for TG Worldwide", "689b52892c175da5bf083ba1")],
				},
				{
					id: "learn-unheard-protocol",
					text: "Learn more about The Unheard's protocol",
					items: [item("Document mentioning a protocol", "689b5256147eeab4410ecd14")],
				},
				{
					id: "unheard-tarkov-link",
					text: "Figure out how The Unheard are connected to Tarkov",
					items: [item("Document mentioning the Warden", "689b5218533aa51a060f810a")],
					note: "Major evidence for Mr. Kerman in The Ticket.",
					rewards: ["128,000 EXP", '"Trail of Breadcrumbs" achievement'],
				},
			],
		},
	],
};
