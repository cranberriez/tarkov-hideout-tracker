import type { StoryChapter, StoryItemRef } from "@/types/story";

/**
 * Blue Fire, reviewed against the EFT wiki on 2026-10-06. Items without an `id`
 * are story items absent from the item catalog.
 */

const item = (name: string, id?: string, count?: number, extra: Pick<StoryItemRef, "chapterId" | "note"> = {}) => ({
	name,
	...(id ? { id } : {}),
	...(count ? { count } : {}),
	...extra,
});

const DEVICE_FRAGMENT = item("Unknown device fragment", "68e6394e658d876c930977b1");
const RUS_POST_CAR_KEY = item("Rus Post car key", "68e63b56ad8cba49190ea529");

export const BLUE_FIRE: StoryChapter = {
	id: "blue-fire",
	name: "Blue Fire",
	wikiLink: "https://escapefromtarkov.fandom.com/wiki/Blue_Fire",
	banner: "/images/story/blue-fire/banner.webp",
	icon: "/images/story/blue-fire/icon.webp",
	summary: "Find out what EMP weapon hit the city, decide who keeps its fragment, and recover the Item 1156 blueprint.",
	previousChapterIds: [],
	decisionIds: ["blue-fire-fragment"],
	sections: [
		{
			id: "emp-blast",
			title: "Ask Mechanic about the EMP blast",
			steps: [
				{
					id: "read-emp-lead",
					text: "Read the EMERCOM leaflet or the Note by Item 1156",
					items: [
						item("EMERCOM leaflet", "68e63d4794fb983cb7098d2d"),
						item("Note by Item 1156", "68e63e8d94fb983cb7098d32"),
					],
					note: "Starts the chapter. Woods: green container at the Scav base. Interchange: the tents near Path to River and by the highway, or the EMERCOM medical unit in ULTRA. The Labyrinth: table in the prototype weapon area.",
				},
				{
					id: "talk-mechanic-emp",
					text: "Talk to Mechanic about the EMP blast",
					note: "Through the trader screen.",
					substeps: [{ id: "mechanic-access", text: "Gain access to Mechanic", optional: true }],
				},
			],
		},
		{
			id: "device-fragment",
			title: "Recover the device fragment",
			steps: [
				{
					id: "obtain-device-fragment",
					text: "Locate and obtain the device fragment",
					map: "Streets of Tarkov",
					items: [
						DEVICE_FRAGMENT,
						item("Car dealership closed section key", "63a397d3af870e651d58e65b"),
						item("Mysterious room marked key", "64ccc25f95763a1ae376e447"),
					],
					note: "Either the closed section on the LexOs dealership's second floor or the marked room in Chekannaya 13; one key is enough. LexOs is rigged with claymores. Must be found in raid.",
				},
				{ id: "handover-device-fragment", text: "Hand over the device fragment to Mechanic", items: [DEVICE_FRAGMENT] },
			],
		},
		{
			id: "lab-network",
			title: "Hack the Lab's network",
			steps: [
				{
					id: "plant-hacking-device",
					text: "Plant the hacking device in the server room in the Lab",
					map: "The Lab",
					items: [item("Local network hacking device", "68e63a53371639e1e4004b6e")],
					note: "First-floor server room. Mechanic mails you one and barters spares. Auto-completes if you already planted one in Boreas.",
				},
				{ id: "talk-mechanic-fragment", text: "Talk to Mechanic" },
				{
					id: "decide-fragment",
					text: "Keep the fragment of Item 1156 for yourself or hand it over to Mechanic",
					decision: "blue-fire-fragment",
					rewards: ['Kept: "Better Served" achievement', "Handed over: 1,500,000 roubles"],
				},
			],
		},
		{
			id: "item-1156",
			title: "Recover the Item 1156 blueprint",
			steps: [
				{
					id: "find-1156-lead",
					text: "Find a lead on Item 1156",
					items: [
						item("Note mentioning Item 1156", "6877c2dcda2a05d0cb04f983"),
						item("TerraGroup science office key", "658199aa38c79576a2569e13"),
					],
					note: "Ground Zero (level 21+): office 4 on the TerraGroup building's second floor, behind the science office key. Lighthouse: bookshelf by the central stairs in the northern blue chalet. The Lab: desk in office O22. Must be found in raid.",
				},
				{
					id: "investigate-rus-post",
					text: "Investigate the Rus Post office",
					map: "Streets of Tarkov",
					items: [
						item("Rus Post audio tape 11.05 / 001", "68889451ad1e91bfa40db8fd"),
						item("Rus Post audio tape 11.05 / 002", "688894da0bc983c31509f32a"),
						item("Rus Post audio tape 11.05 / 003", "68889504f6192726ac07c66c"),
						item("Audio recorder", "6526909b539ee574cb624991"),
					],
					note: "Listen to the three tapes in the post office; bring an Audio recorder. Must be found in raid.",
				},
				{
					id: "locate-rus-post-car",
					text: "Locate the Rus Post car",
					map: "Streets of Tarkov",
					items: [RUS_POST_CAR_KEY],
					note: "In front of the post office. A key spawns every raid by the back right wheel.",
				},
				{
					id: "obtain-1156-blueprint",
					text: "Obtain the blueprint for Item 1156",
					map: "Streets of Tarkov",
					items: [item("Item 1156 specification", "689b52d6886e9848a4085917"), RUS_POST_CAR_KEY],
					note: "In the back of the car. Must be found in raid. Major evidence for Mr. Kerman in The Ticket.",
					rewards: ["112,000 EXP", '"Inferno" achievement'],
				},
			],
		},
	],
};
