import type { StoryChapter, StoryItemRef } from "@/types/story";

/**
 * Falling Skies, reviewed against the EFT wiki on 2026-10-06. Items without an `id`
 * are story items absent from the item catalog.
 */

const item = (name: string, id?: string, count?: number, extra: Pick<StoryItemRef, "chapterId" | "note"> = {}) => ({
	name,
	...(id ? { id } : {}),
	...(count ? { count } : {}),
	...extra,
});

// The catalog has two "Armored case" items, so this one stays unlinked.
const ARMORED_CASE = item("Armored case");
const PRAPOR_ROUBLE_REWARD = "300,000 roubles (315,000 with Intelligence Center level 1, 345,000 with level 2)";

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
				{ id: "locate-plane", text: "Locate the fallen plane", map: "Woods", note: "On the eastern side of Woods." },
				{
					id: "prapor-ll2",
					text: "Reach Loyalty Level 2 with Prapor",
					note: "Ask Prapor about the plane, then ask again at LL2.",
				},
				{
					id: "ask-traders-plane",
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
					text: "Hand over 2,000 dollars to Therapist to learn details about the SUV",
					optional: true,
					items: [item("Dollars", "5696686a4bdc2da3298b456a", 2_000)],
					note: "She reveals which SUV holds the flash drive.",
				},
				{
					id: "retrieve-gwagon-drive",
					text: "Retrieve the flash drive from one of the G-Wagon SUVs",
					map: "Shoreline",
					items: [item("G-Wagon flash drive")],
					note: "Driver-side running board of the G-Wagon next to the Tunnel extract. Must be found in raid.",
				},
				{ id: "handover-gwagon-drive", text: "Hand over the flash drive to Prapor" },
				{
					id: "wait-prapor-1",
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
					text: "Retrieve the plane's flight recorder",
					map: "Woods",
					items: [item("Crashed plane's flight recorder")],
					note: "In the broken section near the back, on the right side of the plane. Must be found in raid.",
				},
				{
					id: "stash-flight-recorder",
					text: "Leave the flight recorder in the specified spot",
					map: "Shoreline",
					note: "In the destroyed room of the house on the island.",
				},
				{ id: "visit-prapor", text: "Visit Prapor" },
				{
					id: "handover-batteries",
					text: "Hand over 3 found in raid Rechargeable batteries",
					items: [item("Rechargeable battery", "590a358486f77429692b2790", 3)],
					note: "Craftable at Workbench level 2.",
				},
				{
					id: "handover-circuit-boards",
					text: "Hand over 5 found in raid Printed circuit boards",
					items: [item("Printed circuit board", "590a3b0486f7743954552bdb", 5)],
					note: "Craftable at Workbench level 1.",
				},
				{
					id: "handover-toolsets",
					text: "Hand over 2 found in raid Toolsets",
					items: [item("Toolset", "590c2e1186f77425357b6124", 2)],
					note: "Craftable at Workbench level 1.",
				},
				{ id: "wait-prapor-2", text: "Wait for information from Prapor", note: "Takes 3–5 hours." },
			],
		},
		{
			id: "elektronik",
			title: "Recover Elektronik's intel",
			steps: [
				{
					id: "handover-crew-transcript",
					text: "Hand over the flight crew's transcript to Prapor",
					map: "Shoreline",
					items: [item("Plane crew transcript")],
					note: "Chairman's house: under the mattress of the overturned bed. Must be found in raid.",
				},
				{
					id: "handover-elektronik-drive",
					text: "Hand over Elektronik's secure flash drive to Prapor",
					map: "Shoreline",
					items: [item("Elektronik's flash drive")],
					note: "Chairman's house: on the shelf next to the bed. Must be found in raid. The reward needs both items.",
					rewards: [PRAPOR_ROUBLE_REWARD],
				},
				{
					id: "wait-prapor-3",
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
					text: "Retrieve the armored case",
					map: "Woods",
					items: [ARMORED_CASE],
					note: "Behind the cockpit of the fallen plane. Must be found in raid.",
					substeps: [
						{
							id: "find-kerman-note",
							text: "Find any additional clues",
							optional: true,
							map: "Woods",
							items: [item("Note from Mr. Kerman", "689b4ed2987b304021088e8f")],
							note: "On the pilot seat.",
						},
					],
				},
				{
					id: "decide-armored-case",
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
