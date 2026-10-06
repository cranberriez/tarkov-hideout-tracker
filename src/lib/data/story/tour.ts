import type { StoryChapter } from "@/types/story";
import { chapterImage, item } from "./helpers";

/**
 * Tour, reviewed against the EFT wiki on 2026-10-06. Items without an `id`
 * are story items absent from the item catalog. Step images are wiki screenshots.
 */

const image = chapterImage("tour");

const LABS_ACCESS = item("TerraGroup Labs access keycard", "5c94bbff86f7747ee735c08f");

const RECON_NOTE = 'A "Survived" or "Run-Through" extract counts.';

export const TOUR: StoryChapter = {
	id: "tour",
	name: "Tour",
	wikiLink: "https://escapefromtarkov.fandom.com/wiki/Tour",
	banner: "/images/story/tour/banner.webp",
	icon: "/images/story/tour/icon.webp",
	summary:
		"Escape Ground Zero, meet the traders, unlock every location and find the way out through the port Terminal.",
	previousChapterIds: [],
	decisionIds: [],
	sections: [
		{
			id: "ground-zero",
			title: "Escape Ground Zero",
			steps: [
				{
					id: "escape-ground-zero",
					text: "Escape Ground Zero",
					map: "Ground Zero",
					note: "Tutorial raid: extract at Klimov Street behind the Skyside business center. The hints are optional.",
					images: [image("ground-zero-tutorial-map", "Tutorial map with the Klimov Street extract (map by xTycho)")],
				},
			],
		},
		{
			id: "streets",
			title: "Unlock Streets of Tarkov",
			steps: [
				{ id: "talk-therapist", text: "Talk to Therapist", note: "Through the trader screen." },
				{
					id: "therapist-cash",
					text: "Hand over 250,000 roubles to Therapist",
					items: [item("Roubles", "5449016a4bdc2d6f028b456f", 250_000)],
					rewards: ["Unlocks Streets of Tarkov"],
					substeps: [{ id: "collect-roubles", text: "Collect the required 250,000 roubles", optional: true }],
				},
			],
		},
		{
			id: "traders",
			title: "Meet the traders",
			steps: [
				{ id: "talk-ragman", text: "Talk to Ragman" },
				{
					id: "interchange-recon",
					text: "Survive and extract from Interchange, or visit it 3 times",
					map: "Interchange",
					note: RECON_NOTE,
				},
				{
					id: "tell-ragman",
					text: "Tell Ragman what you found during the recon",
					rewards: ["Unlocks Skier", "Unlocks Customs"],
				},
				{ id: "talk-skier-1", text: "Talk to Skier" },
				{
					id: "customs-recon",
					text: "Survive and extract from Customs, or visit it 3 times",
					map: "Customs",
					note: RECON_NOTE,
				},
				{
					id: "skier-building-materials",
					text: "Hand over any 5 found in raid building materials to Skier",
					note: "All 5 at once; partial hand-ins are not possible.",
					rewards: ["Unlocks Mechanic", "Unlocks Factory"],
					substeps: [
						{
							id: "find-building-materials",
							text: "Find any 5 building materials in raid",
							optional: true,
						},
					],
				},
				{
					id: "talk-mechanic",
					text: "Talk to Mechanic",
					note: "Ask him about the downed plane to start Falling Skies.",
				},
				{
					id: "factory-recon",
					text: "Survive and extract from Factory, or visit it 3 times",
					map: "Factory",
					note: RECON_NOTE,
				},
				{
					id: "mechanic-weapons",
					text: "Hand over any 2 found in raid weapons to Mechanic",
					rewards: ["Unlocks Prapor", "Unlocks Woods"],
					substeps: [{ id: "find-weapons", text: "Find any 2 weapons in raid", optional: true }],
				},
				{ id: "talk-skier-2", text: "Talk to Skier" },
				{
					id: "woods-kills",
					text: "Eliminate any 3 targets",
					map: "Woods",
					note: "The kills don't have to be in the raid you survive.",
				},
				{
					id: "woods-recon",
					text: "Survive and extract from Woods, or visit it 3 times",
					map: "Woods",
					note: RECON_NOTE,
					rewards: ["Unlocks Peacekeeper", "Unlocks Shoreline"],
				},
			],
		},
		{
			id: "terminal",
			title: "Contact the port Terminal",
			steps: [
				{
					id: "locate-terminal",
					text: "Locate the entrance to the port Terminal",
					map: "Shoreline",
					note: "South-east corner of Shoreline.",
				},
				{
					id: "find-terminal-contact",
					text: "Find a way to contact the soldiers at the Terminal",
					map: "Shoreline",
					note: "The intercom is on the watchtower in front of the Terminal.",
					images: [
						image("tour-shoreline-map", "Intercom location marked on the map"),
						image("tour-shoreline-tower", "The watchtower with the intercom"),
						image("tour-shoreline-intercom", "The intercom"),
					],
				},
				{
					id: "use-intercom",
					text: "Use the intercom to contact the port garrison",
					map: "Shoreline",
					warning:
						"The guards kill anyone near the Terminal wall, anyone shooting at them, and anyone who keeps using the intercom after being told to leave.",
					images: [image("tour-shoreline-intercom", "The intercom")],
				},
				{ id: "learn-escape", text: "Learn how to escape Tarkov" },
			],
		},
		{
			id: "reserve",
			title: "Unlock Reserve",
			steps: [
				{
					id: "shoreline-recon",
					text: "Survive and extract from Shoreline, or visit it 3 times",
					map: "Shoreline",
					note: RECON_NOTE,
				},
				{
					id: "prapor-dogtags",
					text: "Hand over 5 PMC dogtags to Prapor",
					items: [item("PMC dogtag", undefined, 5)],
					note: "Any PMC dogtags; you don't have to kill the PMCs yourself.",
					rewards: ["Unlocks Reserve"],
					substeps: [{ id: "find-dogtags", text: "Find 5 PMC dogtags in raid", optional: true }],
				},
			],
		},
		{
			id: "lighthouse",
			title: "Unlock Lighthouse",
			steps: [
				{
					id: "mechanic-usd",
					text: "Hand over 8,000 dollars to Mechanic",
					items: [item("Dollars", "5696686a4bdc2da3298b456a", 8_000)],
					note: "Peacekeeper sells dollars for roubles.",
					rewards: ["Unlocks Lighthouse"],
					substeps: [{ id: "collect-usd", text: "Collect the required 8,000 dollars", optional: true }],
				},
			],
		},
		{
			id: "the-lab",
			title: "Unlock The Lab",
			steps: [
				{
					id: "access-lab",
					text: "Access the secret TerraGroup facility",
					map: "The Lab",
					items: [LABS_ACCESS],
					note: "Transit from Streets of Tarkov or Factory; transits open 1 minute into the raid. The keycard is used up on entry.",
					substeps: [
						{
							id: "lab-keycard",
							text: "Obtain a keycard or access codes to enter the facility",
							optional: true,
							items: [LABS_ACCESS],
						},
						{
							id: "lab-entrance-factory",
							text: "Locate the entrance to the facility on Factory",
							optional: true,
							map: "Factory",
							note: "In the sewer tunnel connected to the flooded underground area.",
							images: [
								image("factory-transit-to-labs-map", "Transit location marked on the map"),
								image("factory-transit-to-the-lab-2", "The way to the sewer tunnel"),
								image("factory-transit-to-the-lab", "The transit gate in the sewer tunnel"),
							],
						},
						{
							id: "lab-entrance-streets",
							text: "Locate the entrance to the facility on Streets of Tarkov",
							optional: true,
							map: "Streets of Tarkov",
							note: "Underground entrance in front of Klimova 16A, the building with the Cosmonaut painting.",
							images: [
								image("streets-transit-to-labs-map", "Transit location marked on the map"),
								image("streets-transit-to-labs-upstairs", "The basement entrance"),
								image("streets-transit-to-labs-downstairs", "The transit door in the basement"),
							],
						},
					],
				},
				{
					id: "search-lab-offices",
					text: "Search the top management offices",
					map: "The Lab",
					note: "Laboratory manager's office (O21) on the second level.",
					images: [
						image("lab-managers-location-map", "Office location marked on the map"),
						image("lab-managers-bridge", "The top management offices"),
					],
				},
				{
					id: "search-lab-servers",
					text: "Search the server room",
					map: "The Lab",
					note: "Next to the hangar on the first level.",
					images: [
						image("labs-server-room-map", "Server room location marked on the map"),
						image("labs-server-room", "The server room"),
					],
				},
				{
					id: "lab-drainage",
					text: "Locate the escape path through the drainage system",
					map: "The Lab",
					note: "In the basement at the Sewage Conduit extract. You don't need to activate the extract or survive.",
					rewards: ["Unlocks The Lab", '"Pathfinder" achievement'],
					images: [
						image("tour-the-lab-escape-path-map", "Escape path location marked on the map"),
						image("tour-the-lab-escape-path-1", "One of the doors into the sewers"),
						image("tour-the-lab-escape-path-2", "The escape path at the end of the sewers"),
					],
				},
			],
		},
	],
};
