import type { StoryChapter, StoryImage, StoryItemRef } from "@/types/story";

/**
 * Blue Fire, reviewed against the EFT wiki on 2026-10-06. Items without an `id`
 * are story items absent from the item catalog. Step images are wiki screenshots.
 */

const item = (name: string, id?: string, count?: number, extra: Pick<StoryItemRef, "chapterId" | "note"> = {}) => ({
	name,
	...(id ? { id } : {}),
	...(count ? { count } : {}),
	...extra,
});

const image = (file: string, caption: string): StoryImage => ({
	src: `/images/story/blue-fire/steps/${file}.webp`,
	thumb: `/images/story/blue-fire/steps/thumbs/${file}.webp`,
	caption,
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
					images: [
						image("blue-fire-woods-activation-location-map", "Woods: container marked on the map"),
						image("blue-fire-woods-activation-location-container", "Woods: the green container"),
						image("blue-fire-woods-activation-location", "Woods: leaflet on the right side of the cabinet"),
						image(
							"blue-fire-interchange-activation-location-map-1",
							"Interchange: tent near Path to River marked on the map",
						),
						image("blue-fire-interchange-activation-location-1", "Interchange: leaflet on the tent near Path to River"),
						image(
							"blue-fire-interchange-activation-location-map-2",
							"Interchange: tent by the highway marked on the map",
						),
						image("blue-fire-interchange-activation-location-2", "Interchange: leaflet on the tent by the highway"),
						image("emercom-location-map", "Interchange: EMERCOM medical unit marked on the map"),
						image("blue-fire-interchange-activation-location-3", "Interchange: leaflet in the EMERCOM medical unit"),
						image("labyrinth-missile-area-map", "The Labyrinth: prototype weapon area marked on the map"),
						image("blue-fire-the-labyrinth-activation-location", "The Labyrinth: the note"),
					],
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
					images: [
						image("car-dealer-map", "LexOs: dealership marked on the map"),
						image("lexos-claymore-overview", "LexOs: complex overview"),
						image("car-dealer", "LexOs: the dealership"),
						image("car-dealer-closed-section-door", "LexOs: grate door to the closed section"),
						image("blue-fire-device-fragment-lexos", "LexOs: the fragment in a food container"),
						image("mysterious-marked-key-map", "Chekannaya 13: marked room location on the map"),
						image("mysterious-key-building-entrance", "Chekannaya 13: enter through a window from the courtyard"),
						image("mysterious-key-path-1", "Chekannaya 13: go down the corridor to the second room on the left"),
						image("mysterious-key-path-2", "Chekannaya 13: go through the hole in the bedroom wall"),
						image("mysterious-key-path-3", "Chekannaya 13: go downstairs and take the door on the left"),
						image("mysterious-key-room-door", "Chekannaya 13: the marked room door"),
						image("blue-fire-device-fragment-chekannaya-13", "Chekannaya 13: the fragment in the flower pot"),
					],
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
					images: [
						image("labs-server-room-plant-location", "Stashing location marked on the map"),
						image("labs-server-room-plant-location-2", "Stashing location next to the office chairs"),
					],
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
					images: [
						image("saving-the-mole-map", "Ground Zero: TerraGroup building marked on the map"),
						image("ground-zero-terragroup-building", "Ground Zero: the TerraGroup building"),
						image("scientists-office", "Ground Zero: door to the office"),
						image("blue-fire-note-ground-zero", "Ground Zero: the note on the desk in the back right"),
						image("blue-chalet-map", "Lighthouse: chalet marked on the map"),
						image("blue-fire-note-lighthouse", "Lighthouse: the bookshelf with the note"),
						image("blue-fire-lab-office-map", "The Lab: office marked on the map"),
						image("blue-fire-note-lab-1", "The Lab: desk with the note"),
						image("blue-fire-note-lab-2", "The Lab: the note on the desk"),
					],
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
					images: [
						image("post-office-map", "Post office marked on the map"),
						image("post-office", "The post office"),
						image("rus-post-audio-tape-1-spawn", "Tape #1 on the desk with the screen behind the counter"),
						image("rus-post-audio-tape-2-spawn", "Tape #2 on the coffee machine next to the storage room"),
						image(
							"rus-post-audio-tape-3-spawn",
							"Tape #3 on the desk in the back office, through the hallway behind the counter",
						),
					],
				},
				{
					id: "locate-rus-post-car",
					text: "Locate the Rus Post car",
					map: "Streets of Tarkov",
					items: [RUS_POST_CAR_KEY],
					note: "In front of the post office. A key spawns every raid by the back right wheel.",
					images: [image("rus-post-car", "The post car"), image("rus-post-car-key-spawn", "The key next to the wheel")],
				},
				{
					id: "obtain-1156-blueprint",
					text: "Obtain the blueprint for Item 1156",
					map: "Streets of Tarkov",
					items: [item("Item 1156 specification", "689b52d6886e9848a4085917"), RUS_POST_CAR_KEY],
					note: "In the back of the car. Must be found in raid.",
					rewards: ["112,000 EXP", '"Inferno" achievement'],
					images: [image("item-1156-specification-spawn", "The blueprint")],
				},
			],
		},
	],
};
