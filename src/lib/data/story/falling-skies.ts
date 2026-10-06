import type { StoryChapter } from "@/types/story";
import { chapterImage, item } from "./helpers";

/**
 * Falling Skies, reviewed against the EFT wiki on 2026-10-06. Items without an `id`
 * are story items absent from the item catalog. Step images are wiki screenshots.
 */

const image = chapterImage("falling-skies");

// The catalog has two "Armored case" items, so this one stays unlinked.
const ARMORED_CASE = item("Armored case");
const PRAPOR_ROUBLE_REWARD = "300,000 roubles (315,000 with Intelligence Center level 1, 345,000 with level 2)";

const PLANE_IMAGES = [
	image("falling-skies-map", "Plane location marked on the map"),
	image("woods-showcase-12", "The fallen plane"),
];
const CHAIRMAN_HOUSE_IMAGES = [
	image("falling-skies-elektroniks-usb-map", "House location marked on the map"),
	image("chairman-house", "The chairman's house"),
];

export const FALLING_SKIES: StoryChapter = {
	id: "falling-skies",
	name: "Falling Skies",
	wikiLink: "https://escapefromtarkov.fandom.com/wiki/Falling_Skies",
	banner: "/images/story/falling-skies/banner.webp",
	icon: "/images/story/falling-skies/icon.webp",
	summary: "Track down the plane that crashed in the nature reserve and decide who gets the armored case it carried.",
	previousChapterIds: ["tour"],
	decisionIds: ["falling-skies-armored-case"],
	sections: [
		{
			id: "fallen-plane",
			title: "Find the fallen plane",
			steps: [
				{
					id: "locate-plane",
					simplified: "Find the plane in eastern Woods.",
					text: "Locate the fallen plane",
					map: "Woods",
					note: "On the eastern side of Woods.",
					images: PLANE_IMAGES,
				},
				{
					id: "prapor-ll2",
					simplified: false,
					text: "Reach Loyalty Level 2 with Prapor",
					note: "Ask Prapor about the plane, then ask again at LL2.",
				},
				{
					id: "ask-traders-plane",
					simplifiedRequirements: ["Prapor LL2 for the second conversation"],
					simplified: "Ask Prapor about the plane twice, then speak to Therapist, Skier, Mechanic and Jaeger.",
					text: "Ask the traders about the fallen plane",
					note: "Prapor, Therapist, Skier, Mechanic and Jaeger, through the trader screen.",
				},
			],
		},
		{
			id: "g-wagon",
			title: "Retrieve the G-Wagon flash drive",
			steps: [
				{
					id: "therapist-suv-info",
					simplified: false,
					text: "Hand over 2,000 dollars to Therapist to learn details about the SUV",
					optional: true,
					items: [item("Dollars", "5696686a4bdc2da3298b456a", 2_000)],
					note: "She reveals which SUV holds the flash drive.",
				},
				{
					id: "retrieve-gwagon-drive",
					simplifiedRequirements: ["Found in raid"],
					simplified: "Loot the flash drive: G-Wagon by Tunnel, driver-side running board.",
					text: "Retrieve the flash drive from one of the G-Wagon SUVs",
					map: "Shoreline",
					items: [item("G-Wagon flash drive")],
					note: "Driver-side running board of the G-Wagon next to the Tunnel extract. Must be found in raid.",
					images: [
						image("falling-skies-g-wagon-usb-map", "SUV location marked on the map"),
						image("falling-skies-g-wagon-usb-spawn", "The flash drive on the SUV's running board"),
					],
				},
				{ id: "handover-gwagon-drive", simplified: false, text: "Hand over the flash drive to Prapor" },
				{
					id: "wait-prapor-1",
					simplified: "Give Prapor the drive. Wait 1 hour, then ask about the plane.",
					text: "Wait for information from Prapor",
					note: "Takes 1 hour; then ask him about the plane again.",
				},
			],
		},
		{
			id: "flight-recorder",
			title: "Recover the flight recorder",
			steps: [
				{
					id: "retrieve-flight-recorder",
					simplifiedRequirements: ["Found in raid"],
					simplified: "Loot the recorder: broken rear section, right side of the plane.",
					text: "Retrieve the plane's flight recorder",
					map: "Woods",
					items: [item("Crashed plane's flight recorder")],
					note: "In the broken section near the back, on the right side of the plane. Must be found in raid.",
					images: [
						...PLANE_IMAGES,
						image("falling-skies-flight-recorder-spawn", "The broken section with the recorder"),
						image("falling-skies-flight-recorder-spawn-close-up", "The recorder"),
					],
				},
				{
					id: "stash-flight-recorder",
					simplified: "Stash it in the island house’s destroyed room.",
					text: "Leave the flight recorder in the specified spot",
					map: "Shoreline",
					note: "In the destroyed room of the house on the island.",
					images: [
						image("falling-skies-flight-recorder-stash-map", "House location marked on the map"),
						image("falling-skies-flight-recorder-stash-location", "The stash spot"),
					],
				},
				{ id: "visit-prapor", simplified: false, text: "Visit Prapor" },
				{
					id: "handover-batteries",
					simplified: false,
					text: "Hand over 3 found in raid Rechargeable batteries",
					items: [item("Rechargeable battery", "590a358486f77429692b2790", 3)],
					note: "Craftable at Workbench level 2.",
				},
				{
					id: "handover-circuit-boards",
					simplified: false,
					text: "Hand over 5 found in raid Printed circuit boards",
					items: [item("Printed circuit board", "590a3b0486f7743954552bdb", 5)],
					note: "Craftable at Workbench level 1.",
				},
				{
					id: "handover-toolsets",
					simplifiedRequirements: ["Found in raid"],
					simplifiedItems: [
						item("Rechargeable battery", "590a358486f77429692b2790", 3),
						item("Printed circuit board", "590a3b0486f7743954552bdb", 5),
						item("Toolset", "590c2e1186f77425357b6124", 2),
					],
					simplified: "Visit Prapor and hand over the supplies.",
					text: "Hand over 2 found in raid Toolsets",
					items: [item("Toolset", "590c2e1186f77425357b6124", 2)],
					note: "Craftable at Workbench level 1.",
				},
				{
					id: "wait-prapor-2",
					simplified: "Wait 3–5 hours.",
					text: "Wait for information from Prapor",
					note: "Takes 3–5 hours.",
				},
			],
		},
		{
			id: "elektronik",
			title: "Recover Elektronik's intel",
			steps: [
				{
					id: "handover-crew-transcript",
					simplifiedRequirements: ["Found in raid"],
					simplified: "Chairman’s house: loot the transcript under the overturned bed’s mattress. Give it to Prapor.",
					text: "Hand over the flight crew's transcript to Prapor",
					map: "Shoreline",
					items: [item("Plane crew transcript")],
					note: "Chairman's house: under the mattress of the overturned bed. Must be found in raid.",
					images: [
						...CHAIRMAN_HOUSE_IMAGES,
						image("falling-skies-elektroniks-transcript", "The transcript under the mattress of the overturned bed"),
					],
				},
				{
					id: "handover-elektronik-drive",
					simplifiedRequirements: ["Found in raid"],
					simplified: "Same house: loot the drive on the bedside shelf. Give it to Prapor.",
					text: "Hand over Elektronik's secure flash drive to Prapor",
					map: "Shoreline",
					items: [item("Elektronik's flash drive")],
					note: "Chairman's house: on the shelf next to the bed. Must be found in raid. The reward needs both items.",
					rewards: [PRAPOR_ROUBLE_REWARD],
					images: [
						...CHAIRMAN_HOUSE_IMAGES,
						image("falling-skies-elektroniks-flash-drive", "The flash drive on the shelf next to the bed"),
					],
				},
				{
					id: "wait-prapor-3",
					simplified: "Wait 1–3 hours. Tell Prapor you read the transcript.",
					text: "Wait for information from Prapor",
					note: "Takes 1–3 hours. Say yes when he asks if you read the transcript; no forfeits the reward.",
					rewards: [PRAPOR_ROUBLE_REWARD],
				},
			],
		},
		{
			id: "armored-case",
			title: "Decide the armored case's fate",
			steps: [
				{
					id: "retrieve-armored-case",
					simplifiedRequirements: ["Found in raid"],
					simplified: "Loot the armored case behind the cockpit.",
					text: "Retrieve the armored case",
					map: "Woods",
					items: [ARMORED_CASE],
					note: "Behind the cockpit of the fallen plane. Must be found in raid.",
					images: [image("falling-skies-armored-case-spawn", "The armored case")],
					substeps: [
						{
							id: "find-kerman-note",
							simplified: false,
							text: "Find any additional clues",
							optional: true,
							map: "Woods",
							items: [item("Note from Mr. Kerman", "689b4ed2987b304021088e8f")],
							note: "On the pilot seat.",
							images: [image("falling-skies-kerman-note-spawn", "The note on the pilot seat")],
						},
					],
				},
				{
					id: "decide-armored-case",
					simplified: "Keep the armored case or give it to Prapor.",
					text: "Keep the armored case for yourself or hand it over to Prapor",
					decision: "falling-skies-armored-case",
					items: [ARMORED_CASE],
					rewards: [
						"80,000 EXP",
						'Kept: the Armored case and the "Just Business" achievement; Prapor reputation -0.7',
						'Handed over: 1,500,000 roubles (1,000,000 if you first pretend you didn\'t find it) and the "Man of His Word" achievement',
					],
				},
			],
		},
	],
};
