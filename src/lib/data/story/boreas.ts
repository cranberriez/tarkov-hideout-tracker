import type { StoryChapter, StoryCondition, StoryImage, StoryItemRef, StoryQuestRef } from "@/types/story";

/**
 * Boreas, reviewed against the EFT wiki on 2026-10-06. Items without an `id`
 * are story items absent from the item catalog. Step images are wiki screenshots.
 */

const item = (name: string, id?: string, count?: number, extra: Pick<StoryItemRef, "chapterId" | "note"> = {}) => ({
	name,
	...(id ? { id } : {}),
	...(count ? { count } : {}),
	...extra,
});

const image = (file: string, caption: string): StoryImage => ({
	src: `/images/story/boreas/steps/${file}.webp`,
	thumb: `/images/story/boreas/steps/thumbs/${file}.webp`,
	caption,
});

const fallingSkiesDone: StoryCondition = { decision: "boreas-falling-skies-progress", is: "completed" };
const fallingSkiesPending: StoryCondition = { decision: "boreas-falling-skies-progress", is: "not-completed" };
const caseKept: StoryCondition = { decision: "falling-skies-armored-case", is: "kept" };
const priceOfIndependence: StoryCondition = { decision: "boreas-btr-quests", is: "price-of-independence" };
const chooseYourFriends: StoryCondition = { decision: "boreas-btr-quests", is: "choose-your-friends" };
const neitherBtrQuest: StoryCondition = { decision: "boreas-btr-quests", is: "neither" };

const ENGINE_ROOM_KEYCARD = item("Boreas engine room keycard", "69bb3e54d6c67f6265004ab9");
const SZ1_CHARGE = item("SZ-1 explosive charge (Icebreaker)", "69a0174087a75d2cbd0842e8");
const C1_KEYCARD = item("Compartment C-1 keycard", "69bb3f278af9f360ee010a7a");
const HARD_DRIVES = [1, 2, 3].map((n) => item(`Hard drive from compartment C-1 (${n})`));
const SKIER_REPORTS = item("Skier's docs");

const QUESTS = {
	priceOfIndependenceA: { id: "6744af0969a58fceba101fed", name: "The Price of Independence" },
	priceOfIndependenceB: { id: "6745cbee909d2013670a4a55", name: "The Price of Independence (alternate)" },
	chooseYourFriends: { id: "67460662d0fbbc74ca0f7229", name: "Choose Your Friends Wisely" },
	stickToIt: { id: "69c26c07683c9831020018c7", name: "Stick to It" },
	aBitterVictory: { id: "69c277f3ea6da9c23e07f8d2", name: "A Bitter Victory" },
	hangover: { id: "69c2a2d004de49c8f0055a3d", name: "Hangover" },
	aWedgeBetweenUs: { id: "69ce1cfb298a6529b30d712b", name: "A Wedge Between Us" },
	freshStock: { id: "69ce21e990144e437802b1e0", name: "Fresh Stock" },
	oilChange: { id: "69ce1de03e15cd80bd06f6c9", name: "Oil Change" },
	warNeverChanges: { id: "69ce204c8702b378f9091e4b", name: "War Never Changes" },
} satisfies Record<string, StoryQuestRef>;

const INTERCOM_IMAGES = [
	image("boreas-scientist-intercom-map", "Intercom location marked on the map"),
	image("boreas-door-to-scientist-intercom", "The door next to the stairs leading to the intercom"),
	image("boreas-scientist-intercom", "The intercom"),
];
const ENGINE_KEYCARD_IMAGES = [
	image("boreas-engine-room-keycard-spawn-1", "Keycard spawn next to the engineer's head"),
	image("boreas-engine-room-keycard-spawn-2", "Keycard spawn in the engineer's right hand"),
	image("boreas-engine-room-keycard-spawn-3", "Keycard spawn in the engineer's left hand"),
];
const ENGINE_ROOM_IMAGES = [
	image("boreas-engine-room-keycard-door-map", "Keycard door location marked on the map"),
	image("boreas-engine-room-keycard-door", "The keycard door"),
	image("boreas-engine-room-map", "Engine room location marked on the map"),
	image("boreas-engine-room-door", "The engine room door to unseal"),
	image("boreas-engine-room-objective", "Access to the engine room"),
	image("boreas-engine-room", "The engine room"),
];
const DAMAGED_DOOR_IMAGES = [
	image("boreas-damaged-door-map", "Damaged door location marked on the map"),
	image(
		"boreas-helipad-to-minus-two-level",
		"Take the stairs on the left after leaving the drone hangar and go all the way round",
	),
	image("stick-to-it-activation-chained-door", "The chained door"),
];
const CODE_DOOR_IMAGES = [
	image("boreas-upper-decks-sealed-door", "The door to unseal"),
	image("boreas-upper-decks-code-locked-door", "The code-locked door"),
];
const SMUGGLER_BASE_IMAGES = [
	image("shoreline-smuggler-base-map", "Shoreline smuggler base marked on the map"),
	image("interchange-smuggler-base-map", "Interchange smuggler base marked on the map"),
];
const C1_IMAGES = [
	image("compartment-c-1-keycard-map", "Compartment C-1 location marked on the map"),
	image("compartment-c-1-keycard-door", "The door to compartment C-1"),
];

export const BOREAS: StoryChapter = {
	id: "boreas",
	name: "Boreas",
	wikiLink: "https://escapefromtarkov.fandom.com/wiki/Boreas",
	banner: "/images/story/boreas/banner.webp",
	icon: "/images/story/boreas/icon.webp",
	summary:
		"Trace a distress signal to the icebreaker Boreas, fight your way to its bridge, and evacuate the last surviving scientist.",
	previousChapterIds: [],
	decisionIds: ["boreas-falling-skies-progress", "falling-skies-armored-case", "boreas-btr-quests"],
	sections: [
		{
			id: "distress-signal",
			title: "Trace the distress signal",
			steps: [
				{
					id: "start-signal",
					text: "Find the Paradigm Shipping poster or check the distress signal on the radio",
					items: [item("Paradigm Shipping poster", "699f0b877c23862b4b0ee19c")],
					note: "Starts the chapter. The radio needs Intelligence Center level 3.",
				},
				{
					id: "ask-signal-origin",
					text: "Ask Mechanic where the distress signal came from",
					note: "Through the trader screen. Starting from the poster, you ask the traders about TerraGroup and Paradigm Shipping instead.",
				},
				{
					id: "locate-tower-equipment",
					text: "Locate the equipment under the cellular tower",
					map: "Woods",
					note: "At the Scav bunker.",
					images: [image("thirsty-delivery-woods-map", "Scav bunker location marked on the map")],
				},
				{
					id: "repair-tower-equipment",
					text: "Repair the equipment under the cellular tower",
					map: "Woods",
					items: [item("Toolset", "590c2e1186f77425357b6124")],
					note: "The toolset is used up.",
					images: [image("boreas-equipment", "The equipment")],
				},
				{ id: "report-mechanic-tower", text: "Report back to Mechanic" },
				{
					id: "obtain-paradigm-directive",
					text: "Locate and obtain the Paradigm Shipping documentation",
					map: "Lighthouse",
					items: [item("Paradigm Shipping directive", "69bb4499957ebbdeb600393f")],
					note: "Warehouse at the freight yard in the north, on the table next to the lamp. Pick it up and read it. Must be found in raid.",
					images: [
						image("boreas-lighthouse-warehouse-map", "Warehouse location marked on the map"),
						image("boreas-paradigm-shipping-directive", "The directive on the table next to the lamp"),
					],
				},
				{ id: "tell-mechanic-boreas", text: "Tell Mechanic about “Boreas”" },
			],
		},
		{
			id: "prapor-transport",
			title: "Arrange transport with Prapor",
			steps: [
				{
					id: "ask-prapor-transport",
					text: "Arrange a transport to the icebreaker",
					note: "Ask Prapor through the trader screen. His price depends on Falling Skies.",
					decision: "boreas-falling-skies-progress",
				},
				{
					id: "reserve-kills",
					text: "Eliminate any 30 targets",
					map: "Reserve",
					when: fallingSkiesPending,
				},
				{
					id: "reserve-yellow-flare",
					text: "Launch a yellow signal flare at the Woods transit",
					map: "Reserve",
					when: fallingSkiesPending,
					items: [
						item("RSP-30 reactive signal cartridge (Yellow)", "624c0b3340357b5f566e8766"),
						item("ZiD SP-81 26x75 signal pistol", "620109578d82e67e7911abf2"),
						item("26x75mm flare cartridge (Yellow)", "62389be94d5d474bf712e709"),
					],
					note: "Use an RSP-30 (Prapor LL1) or a signal pistol with a yellow cartridge (Jaeger LL1). Aim up, but not so steeply that it lands behind you; a low flare doesn't count.",
					images: [
						image("reserve-transit-to-woods-map", "Transit location marked on the map"),
						image("reserve-transit-to-woods-2", "Transit location"),
						image("reserve-transit-to-woods", "The transit"),
					],
				},
				{
					id: "handover-power-filters",
					text: "Hand over 3 Military power filters to Prapor",
					when: { all: [fallingSkiesDone, caseKept] },
					items: [item("Military power filter", "5d0378d486f77420421a5ff4", 3)],
					note: "Must be found in raid.",
				},
				{
					id: "handover-amg-fluid",
					text: "Hand over the AMG-10 fluid to Prapor",
					map: "Reserve",
					items: [item("AMG-10 hydraulic fluid (quest item)")],
					note: "Several spawns: shelves and the spotlight pallet in the black bishop basement's northern storage, and in and behind the helicopter at the parade ground. The barter AMG-10 hydraulic fluid doesn't count. Must be found in raid.",
					images: [
						image("amg-10-hydraulic-fluid-spawn-6", "1: Shelf in the black bishop basement's northern storage"),
						image("amg-10-hydraulic-fluid-spawn-1", "2: Shelf in the black bishop basement's northern storage"),
						image("amg-10-hydraulic-fluid-spawn-2", "3: Pallet with the spotlight in the northern storage"),
						image("amg-10-hydraulic-fluid-spawn-3", "4: Open wooden crate inside the parade ground helicopter"),
						image("amg-10-hydraulic-fluid-spawn-4", "5: Under the ladder inside the parade ground helicopter"),
						image("amg-10-hydraulic-fluid-spawn-5", "6: Next to the forklift behind the helicopter"),
					],
				},
			],
		},
		{
			id: "btr-transport",
			title: "Find another way with the BTR Driver",
			steps: [
				{ id: "find-alternative-transport", text: "Find an alternative transport to the icebreaker" },
				{
					id: "talk-btr-transport",
					text: "Talk to the BTR Driver",
					note: "His tasks depend on which of his quests you have completed.",
					quests: [QUESTS.priceOfIndependenceA, QUESTS.priceOfIndependenceB, QUESTS.chooseYourFriends],
					decision: "boreas-btr-quests",
				},
				{
					id: "return-hideout-btr",
					text: "Return to the Hideout",
					when: priceOfIndependence,
					note: "Extract or die.",
				},
				{ id: "return-btr-independence", text: "Return to the BTR Driver", when: priceOfIndependence },
				{
					id: "handover-bt-gzh",
					text: "Hand over 200 7.62x54mm R BT gzh rounds",
					when: chooseYourFriends,
					items: [item("7.62x54mm R BT gzh", "5e023d34e8a400319a28ed44", 200)],
					note: "Not found-in-raid.",
				},
				{
					id: "obtain-skier-reports",
					text: "Locate and obtain Skier's reports",
					map: "Customs",
					when: chooseYourFriends,
					items: [SKIER_REPORTS],
					note: "In the ditch between the Scav base and the laboratory. Must be found in raid.",
					images: [
						image("boreas-skiers-docs-map", "Location marked on the map"),
						image("boreas-skiers-docs-location", "The reports"),
					],
				},
				{
					id: "burn-skier-reports",
					text: "Burn Skier's reports",
					map: "Customs",
					when: chooseYourFriends,
					items: [SKIER_REPORTS],
					note: "At any fire barrel; the closest is in the middle living quarters of the Scav base.",
					images: [
						image("easy-money-part-1customs-map-1", "Scav base location marked on the map"),
						image("zb-013-building", "The Scav base"),
						image("customs-scav-base-fire-barrel", "The fire barrel"),
					],
				},
				{
					id: "smuggler-kills-15",
					text: "Eliminate any 15 targets at the smugglers' territories",
					map: "Shoreline or Interchange",
					when: chooseYourFriends,
					note: "At the smuggler bases.",
					images: SMUGGLER_BASE_IMAGES,
				},
				{ id: "report-btr-friends", text: "Report back to the BTR Driver", when: chooseYourFriends },
				{
					id: "smuggler-kills-10",
					text: "Eliminate any 10 targets at the smugglers' territories",
					map: "Shoreline or Interchange",
					when: neitherBtrQuest,
					note: "At the smuggler bases.",
					images: SMUGGLER_BASE_IMAGES,
				},
				{ id: "report-btr-neither", text: "Report back to the BTR Driver", when: neitherBtrQuest },
				{ id: "tell-mechanic-transport", text: "Tell Mechanic that you found transport to the icebreaker" },
			],
		},
		{
			id: "first-boarding",
			title: "Board the icebreaker",
			steps: [
				{
					id: "board-hovercraft",
					text: "Board the smuggler hovercraft",
					map: "Shoreline or Lighthouse",
					note: "At the piers. Boarding needs a marine repair kit.",
					images: [
						image("shoreline-transit-to-icebreaker-map", "Shoreline hovercraft marked on the map"),
						image("shoreline-transit-to-icebreaker", "The Shoreline hovercraft"),
						image("lighthouse-transit-to-icebreaker-map", "Lighthouse hovercraft marked on the map"),
						image("lighthouse-transit-to-icebreaker", "The Lighthouse hovercraft"),
					],
					substeps: [
						{
							id: "bring-marine-repair-kit",
							text: "Bring a marine repair kit",
							optional: true,
							items: [item("Sudak-Tudak marine repair kit", "6a8c4c7999baf8bd5802f7fe")],
						},
						{
							id: "bring-green-flare",
							text: "Bring a green RSP signal flare",
							optional: true,
							items: [item("RSP-30 reactive signal cartridge (Green)", "6217726288ed9f0845317459")],
							note: "Needed to extract from the icebreaker.",
						},
						{
							id: "bring-euros",
							text: "Bring 2,500 Euros to pay for the evacuation from the icebreaker",
							optional: true,
							items: [item("Euros", "569668774bdc2da2298b4568", 2_500)],
						},
					],
				},
				{ id: "arrive-icebreaker-1", text: "Arrive at the icebreaker", map: "Icebreaker" },
				{
					id: "check-crew-survivors",
					text: "Check if any crew members survived on the ship",
					map: "Icebreaker",
					note: "Talk to the scientist through the intercom on level 1, east side of the ship.",
					images: INTERCOM_IMAGES,
				},
				{
					id: "access-engine-room-1",
					text: "Access the engine room",
					map: "Icebreaker",
					items: [ENGINE_ROOM_KEYCARD],
					note: "Black Division come out on the catwalks halfway through the room.",
					substeps: [
						{
							id: "engine-keycard-1",
							text: "Locate and obtain the engine room keycard",
							optional: true,
							items: [ENGINE_ROOM_KEYCARD],
							note: "Central medical room on level 1, next to an engineer's body.",
							images: ENGINE_KEYCARD_IMAGES,
						},
						{
							id: "reach-engine-room-1",
							text: "Reach the engine room",
							optional: true,
							note: "Keycard door on level 0, east side, next to the control room. Then take the stairs to level 1, unseal the engine room doors and go down to level -2.",
							images: ENGINE_ROOM_IMAGES,
						},
					],
				},
				{
					id: "find-superstructure-way",
					text: "Find a way into the icebreaker superstructure",
					map: "Icebreaker",
					quests: [QUESTS.stickToIt],
					note: "Head for the extract, but go two levels down, round the helipad to the ship's side, and up to the chained door on level 3. Black Division wait on and under the helipad. Trying the door asks for explosives; you can then extract. Unlocks Stick to It.",
					images: [
						image("boreas-damaged-door-map", "Damaged door location marked on the map"),
						image(
							"boreas-helipad-to-minus-two-level",
							"Take the stairs on the left after leaving the drone hangar and go all the way round",
						),
						image("boreas-superstructure-way", "The way to the superstructure"),
					],
				},
			],
		},
		{
			id: "explosives",
			title: "Blow the chained door",
			steps: [
				{ id: "ask-mechanic-explosives", text: "Ask Mechanic about explosives" },
				{
					id: "ask-prapor-explosives",
					text: "Ask Prapor about explosives",
					rewards: ["Unlocks buying the SZ-1 explosive charge (Icebreaker) at Prapor LL1"],
				},
				{ id: "arrive-icebreaker-2", text: "Arrive at the icebreaker", map: "Icebreaker" },
				{
					id: "reach-damaged-door-1",
					text: "Reach the damaged door on the roof of the engine room",
					map: "Icebreaker",
					images: DAMAGED_DOOR_IMAGES,
				},
				{
					id: "break-chain-1",
					text: "Break the chain on the door with the SZ-1 charge",
					map: "Icebreaker",
					items: [SZ1_CHARGE],
					note: "Place the charge on the chain.",
					images: [image("stick-to-it-activation-chained-door", "The chained door")],
				},
				{
					id: "enter-superstructure",
					text: "Enter the icebreaker superstructure from the roof of the engine room",
					map: "Icebreaker",
					note: "The Wedge squad holds the crew quarters, and a tear-gas tripwire guards the entrance.",
					images: [image("boreas-enter-icebreaker-superstructure", "The crew quarters entrance")],
					substeps: [
						{
							id: "inspect-crew-quarters",
							text: "Inspect the crew living quarters",
							optional: true,
							items: [
								item("Sailor's diary", "69bb4558b44453acde02ebe7"),
								item("Boreas crew quarters keycard", "69bb3ec9f609db77390b0e1a"),
							],
							note: "The Sailor's diary is in crew room 18, behind the crew quarters keycard.",
						},
					],
				},
				{
					id: "find-upper-decks-way",
					text: "Find a way to the upper decks of the superstructure",
					map: "Icebreaker",
					note: "Once the crew quarters are clear, go to level 5, step outside and take the stairs to a code-locked door.",
					images: CODE_DOOR_IMAGES,
				},
			],
		},
		{
			id: "door-code",
			title: "Get the code for the level 6 door",
			steps: [
				{
					id: "ask-scientist-code",
					text: "Ask the surviving scientist how to open the code-locked door on level 6",
					map: "Icebreaker",
					note: "Intercom on level 1, east side of the ship.",
					images: INTERCOM_IMAGES,
				},
				{ id: "ask-mechanic-code", text: "Ask Mechanic for help with finding the second part of the code" },
				{
					id: "plant-hacking-device",
					text: "Plant the hacking device in the server room in the Lab",
					map: "The Lab",
					items: [item("Local network hacking device", "68e63a53371639e1e4004b6e")],
					note: "First-floor server room, next to the office chairs. Mechanic mails you one and barters spares. Auto-completes if you already planted one in Blue Fire.",
					images: [
						image("labs-server-room-plant-location", "Stash location marked on the map"),
						image("labs-server-room-plant-location-2", "Stash location next to the office chairs"),
					],
				},
				{ id: "return-mechanic-code", text: "Return to Mechanic" },
			],
		},
		{
			id: "bridge",
			title: "Reach the bridge and compartment C-1",
			steps: [
				{
					id: "arrive-icebreaker-3",
					text: "Arrive at the icebreaker",
					map: "Icebreaker",
					note: "Through the Shoreline transit or from the menu.",
				},
				{
					id: "reach-engine-room-2",
					text: "Reach the engine room",
					map: "Icebreaker",
					items: [ENGINE_ROOM_KEYCARD],
					images: ENGINE_ROOM_IMAGES,
					substeps: [
						{
							id: "engine-keycard-2",
							text: "Locate and obtain the engine room keycard",
							optional: true,
							items: [ENGINE_ROOM_KEYCARD],
							note: "Central medical room on level 1, next to an engineer's body.",
							images: ENGINE_KEYCARD_IMAGES,
						},
					],
				},
				{
					id: "reach-damaged-door-2",
					text: "Reach the damaged door on the roof of the engine room",
					map: "Icebreaker",
					images: DAMAGED_DOOR_IMAGES,
				},
				{
					id: "return-btr-side-quest",
					text: "Return to the BTR Driver",
					optional: true,
					quests: [QUESTS.stickToIt, QUESTS.aBitterVictory],
					note: "Only appears after you complete Stick to It or A Bitter Victory.",
				},
				{
					id: "break-chain-2",
					text: "Break the chain on the door with the SZ-1 charge",
					map: "Icebreaker",
					items: [SZ1_CHARGE],
					images: [image("stick-to-it-activation-chained-door", "The chained door")],
				},
				{
					id: "reach-code-door",
					text: "Reach the code-locked door",
					map: "Icebreaker",
					note: "Through the crew quarters to level 5, then outside and up the stairs.",
					images: CODE_DOOR_IMAGES,
				},
				{
					id: "use-access-code",
					text: "Use the correct access code",
					map: "Icebreaker",
					note: "3-1-2-2-2-0. It never changes and opens every door in the zone that leads outside.",
					images: [image("boreas-upper-decks-code-locked-door", "The code-locked door")],
				},
				{
					id: "locate-compartment-c1",
					text: "Locate compartment C-1",
					map: "Icebreaker",
					items: [item("Compartment C-1 access log", "69bb44cbd6c67f6265004ac1")],
					note: "Level 7, next to the exit outside. The access log lies by the door.",
					images: C1_IMAGES,
					substeps: [
						{
							id: "obtain-c1-keycard",
							text: "Locate and obtain the keycard with access to compartment C-1",
							optional: true,
							items: [C1_KEYCARD],
							note: "In the left hand of the captain's body on the bridge, level 9.",
						},
						{ id: "locate-bridge-entrance", text: "Locate the entrance to the bridge", optional: true },
						{ id: "locate-bridge-alternative", text: "Locate an alternative path to the bridge", optional: true },
					],
				},
				{
					id: "reach-upper-decks",
					text: "Reach the upper decks",
					map: "Icebreaker",
					note: "Leave the level 7 rooms with the same code and go upstairs to the bridge.",
					images: [image("boreas-bridge-doors", "The door to the bridge")],
				},
				{
					id: "thaw-bridge-hatch",
					text: "Thaw the hatch on the roof of the bridge",
					map: "Icebreaker",
					items: [item("BBQ-S43 gas torch", "67ab3d4b83869afd170fdd3f")],
					note: "A frozen hatch with a frozen lever.",
					images: [image("gas-torch-apply-icebreaker", "The hatch to thaw")],
					substeps: [
						{
							id: "find-gas-torch",
							text: "Find something to thaw the hatch",
							optional: true,
							note: "The level 3 kitchen where The Wedge appears.",
							images: [
								image("boreas-bbqspawn-1", "On a countertop next to the lockers"),
								image("boreas-bbqspawn-2", "In a green crate on a countertop next to the lockers"),
								image("boreas-bbqspawn-3", "In a wooden crate on a serving trolley"),
							],
						},
					],
				},
				{
					id: "rescue-captain",
					text: "Rescue the icebreaker captain",
					map: "Icebreaker",
					note: "Completes when you reach his body on the bridge, level 9.",
					images: [image("compartment-c-1-keycard-spawn", "The captain's body, holding the C-1 keycard")],
				},
				{
					id: "access-compartment-c1",
					text: "Access compartment C-1",
					map: "Icebreaker",
					items: [C1_KEYCARD],
					images: C1_IMAGES,
				},
				{
					id: "search-c1-shelves",
					text: "Search the shelves in compartment C-1",
					map: "Icebreaker",
					items: [HARD_DRIVES[2]],
					note: "On the shelf with the keyboard, left of the entrance. Must be found in raid.",
					images: [image("boreas-hdd1-spawn", "On the shelf with the keyboard")],
				},
				{
					id: "search-c1-workstation",
					text: "Search the area near the workstation in compartment C-1",
					map: "Icebreaker",
					items: [HARD_DRIVES[0]],
					note: "On the PC blocks under the desk. Must be found in raid.",
					images: [image("boreas-hdd2-spawn", "On top of the PC blocks under the desk")],
				},
				{
					id: "search-c1-servers",
					text: "Search the servers in compartment C-1",
					map: "Icebreaker",
					items: [HARD_DRIVES[1]],
					note: "On top of the servers on the floor. Must be found in raid.",
					images: [image("boreas-hdd3-spawn", "On top of the server on the floor")],
				},
			],
		},
		{
			id: "decode-drives",
			title: "Decode the hard drives with Mechanic",
			steps: [
				{
					id: "handover-hard-drives",
					text: "Ask Mechanic for help decoding the hard drives",
					items: HARD_DRIVES,
					quests: [QUESTS.aWedgeBetweenUs, QUESTS.freshStock, QUESTS.oilChange, QUESTS.warNeverChanges],
					note: "Hand over the three drives. This unlocks four side quests that the chapter doesn't need.",
				},
				{
					id: "handover-ultralink",
					text: "Hand over 3 Ultralink satellite modules to Mechanic",
					items: [item("Ultralink satellite communication module", "69bb41c03b5fb75517065960", 3)],
					note: "Must be found in raid.",
					substeps: [
						{ id: "find-ultralink", text: "Locate and obtain Ultralink modules on the icebreaker", optional: true },
					],
				},
				{
					id: "handover-server-ram",
					text: "Hand over 4 server RAM modules to Mechanic",
					items: [item("Memento Server RAM Module", "69bb424e99f3fda8f107247d", 4)],
					note: "Must be found in raid.",
					substeps: [
						{ id: "find-server-ram", text: "Locate and obtain server RAM modules on the icebreaker", optional: true },
					],
				},
				{
					id: "handover-crypto-processors",
					text: "Hand over 2 cryptographic processors to Mechanic",
					items: [item("IBX Gigachad cryptographic processor", "69bb4203f94327bc0f0230cd", 2)],
					note: "Must be found in raid.",
					rewards: ["Icebreaker archive data"],
					substeps: [
						{
							id: "find-crypto-processors",
							text: "Locate and obtain cryptographic processors on the icebreaker",
							optional: true,
						},
					],
				},
				{
					id: "analyse-archive-data",
					text: "Analyse the data from the icebreaker",
					items: [item("Icebreaker archive data", "69bb45b89c92ecd910059159")],
					note: "Mailed to you; read it in the Handbook.",
				},
			],
		},
		{
			id: "evacuation",
			title: "Evacuate the scientist",
			steps: [
				{
					id: "inform-scientist-captain",
					text: "Inform the scientist about the captain's death",
					map: "Icebreaker",
					note: "Intercom on level 1, east side of the ship.",
					images: INTERCOM_IMAGES,
				},
				{ id: "ask-btr-evacuation", text: "Ask the BTR Driver if he can help evacuate the scientist" },
				{
					id: "assist-smugglers",
					text: "Assist the smugglers with their conflict against the Rogues",
					quests: [QUESTS.hangover],
					note: "Complete Hangover.",
				},
				{ id: "return-btr-evacuation", text: "Return to the BTR Driver" },
				{ id: "icebreaker-kills", text: "Eliminate 20 targets on the icebreaker", map: "Icebreaker" },
				{
					id: "handover-respirators",
					text: "Hand over 5 respirators to the BTR Driver",
					items: [
						item("Respirator", "59e7715586f7742ee5789605"),
						item("Gentex Ops-Core SOTR respirator", "689b404db49f27df1c0873f6"),
						item("GP-5 gas mask", "5b432c305acfc40019478128"),
						item("GP-7 gas mask", "60363c0c92ec1c31037959f5"),
						item("Avon M53A1 gas mask", "689b880fff8b4adc420f5b56"),
					],
					note: "Any of these; not found-in-raid.",
					substeps: [{ id: "obtain-respirators", text: "Obtain respirators for the BTR Driver", optional: true }],
				},
				{
					id: "handover-ballistic-plates",
					text: "Hand over 2 class 5 or higher ballistic plates to the BTR Driver",
					note: "Any class 5+ plate that fits the Kirasa-N; not found-in-raid.",
					substeps: [{ id: "obtain-ballistic-plates", text: "Obtain class 5+ ballistic plates", optional: true }],
				},
				{
					id: "handover-kirasa",
					text: "Hand over the Kirasa-N body armor to the BTR Driver",
					items: [item("BNTI Kirasa-N body armor", "5b44d22286f774172b0c9de8")],
					note: "Not found-in-raid.",
					substeps: [{ id: "obtain-kirasa", text: "Obtain the Kirasa-N body armor", optional: true }],
				},
				{
					id: "inform-scientist-ready",
					text: "Inform the scientist that everything is ready for his evacuation",
					map: "Icebreaker",
					note: "Intercom on level 1, east side of the ship.",
					images: INTERCOM_IMAGES,
				},
				{
					id: "ask-btr-rescue",
					text: "Ask the BTR Driver how the scientist's rescue went",
					map: "Woods or Streets of Tarkov",
					rewards: ["160,000 EXP", "Compartment C-3 keycard"],
					substeps: [
						{
							id: "scientist-audio-tape",
							text: "Find the Boreas scientist audio tape",
							optional: true,
							map: "Icebreaker",
							items: [
								item("Boreas scientist audio tape", "69bb4673d6c67f6265004aca"),
								item("Compartment C-3 keycard", "69bb3f7df94327bc0f0230c9"),
							],
							note: "Not an objective. In the level 1 lab, opened with the C-3 keycard from this chapter.",
						},
					],
				},
			],
		},
	],
};
