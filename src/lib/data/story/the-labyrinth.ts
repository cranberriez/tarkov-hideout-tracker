import type { StoryChapter } from "@/types/story";
import { chapterImage, item } from "./helpers";

/**
 * The Labyrinth, reviewed against the EFT wiki on 2026-10-06.
 * Evidence IDs match the shared evidence list; keycard and equipment reward IDs
 * were supplied by the user. Unverified items remain name-only. Step images are wiki screenshots.
 */
const image = chapterImage("the-labyrinth");
const FACILITY_KEY = item("Knossos LLC facility key");
const LABRYS_KEYCARD = item("Labrys access keycard", "679b9819a2f2dd4da9023512");
const OBSERVATION_KEY = item("Observation room key");
const AUDIO_TAPE = item("Deceased scientist's audio tape");
const RESEARCH_REPORT = item("Labyrinth facility research report", "68d2fdbbf8817df4690db3d5");

const TRANSIT_IMAGES = [
	image("vitamins1-shoreline-outdoor-map", "Health Resort west wing marked on the map"),
	image("the-labyrinth-transit-map", "Transit marked on the west wing basement map"),
	image("the-labyrinth-transit-door", "Door to the transit"),
	image("the-labyrinth-transit", "The Labyrinth transit"),
];

export const THE_LABYRINTH: StoryChapter = {
	id: "the-labyrinth",
	name: "The Labyrinth",
	wikiLink: "https://escapefromtarkov.fandom.com/wiki/The_Labyrinth_(story_chapter)",
	banner: "/images/story/the-labyrinth/banner.webp",
	icon: "/images/story/the-labyrinth/icon.webp",
	summary:
		"Investigate the missing BEAR squad beneath the Health Resort and recover evidence of TerraGroup's experiments.",
	previousChapterIds: [],
	decisionIds: [],
	sections: [
		{
			id: "facility-access",
			title: "Find the entrance and contact Jaeger",
			steps: [
				{
					simplified: "Find the locked transit door in the Resort’s west-wing basement.",
					id: "locate-transit",
					text: "Locate the transit to The Labyrinth",
					map: "Shoreline",
					items: [FACILITY_KEY],
					note: "Starts the chapter. The transit is behind the locked door in the Health Resort west wing basement.",
					images: TRANSIT_IMAGES,
				},
				{
					simplified: "Ask Jaeger about the facility.",
					id: "ask-traders",
					text: "Ask the traders about the underground facility",
					note: "Speak to Jaeger through the trader screen.",
					substeps: [
						{
							simplified: false,
							id: "ask-therapist",
							text: "Ask Therapist how to access the underground facility",
							optional: true,
						},
					],
				},
				{
					simplified: "Wait 12–24 hours, ask Jaeger again and collect the mailed keycards.",
					id: "wait-jaeger-keycards",
					text: "Wait for Jaeger to gather the keycards",
					rewardItems: [{ ...LABRYS_KEYCARD, count: 2 }],
					note: "Wait 12–24 hours, then ask Jaeger about the Labyrinth again. He sends two keycards via in-game mail.",
					rewards: ["2× Labrys access keycard", "Unlocks Jaeger's barter for Labrys access keycards"],
				},
			],
		},
		{
			id: "bear-squad",
			title: "Investigate the BEAR squad",
			steps: [
				{
					simplified: "Follow the BEAR squad’s trail through the facility.",
					id: "investigate-bear-squad",
					text: "Figure out what happened to the BEAR squad",
					map: "The Labyrinth",
					note: "Follow the squad's trail through the facility. The diary and five scientists' notes are minor evidence for Mr. Kerman in The Ticket.",
					substeps: [
						{
							simplified: false,
							id: "locate-facility-entrance",
							text: "Locate the entrance beneath the Health Resort",
							optional: true,
							map: "Shoreline",
							items: [FACILITY_KEY],
							images: TRANSIT_IMAGES,
						},
						{
							simplified: "Transit from the west-wing basement and clear your spawn chamber’s hazard.",
							simplifiedRequirements: ["Labrys keycard • No insurance returns • Traps throughout"],
							id: "access-facility",
							text: "Access the underground facility",
							optional: true,
							map: "Shoreline",
							items: [FACILITY_KEY, LABRYS_KEYCARD],
							note: "Enter by transiting from the west wing basement with a Labrys access keycard. Each spawn chamber has a hazard to resolve before leaving. Insurance does not return equipment lost in The Labyrinth; watch for tripwires, poisoned barbed wire and spike pits.",
						},
						{
							simplified: "Read the orders in the food container in front of spawn chamber 2.",
							simplifiedRequirements: ["Found in raid"],
							id: "find-leshy-orders",
							text: "Locate the traces of the BEAR squad",
							optional: true,
							map: "The Labyrinth",
							items: [item("Leshy's orders")],
							note: "Find the orders in raid, inside a food container on the ground in front of spawn chamber 2.",
							images: [
								image("leshy-s-orders-location-map", "Orders location marked on the map"),
								image("leshy-s-orders-location-far", "The food container in front of spawn chamber 2"),
								image("leshy-s-orders-location-close", "Leshy's orders in the container"),
							],
						},
						{
							simplified: "Search the prototype weapon area.",
							id: "investigate-regroup-spot",
							text: "Investigate the BEAR squad regroup spot at Item 1156",
							optional: true,
							map: "The Labyrinth",
							note: "At the prototype weapon area.",
							images: [image("labryrinth-missile-area-map", "Prototype weapon area marked on the map")],
						},
						{
							simplified: "Find the leader beside the torture room.",
							id: "locate-squad-leader",
							text: "Locate the squad leader",
							optional: true,
							map: "The Labyrinth",
							note: "By the torture room.",
							images: [
								image("labryrinth-torture-room-map", "Torture room marked on the map"),
								image("leshy-s-diary-location-far", "The squad leader next to the torture room"),
							],
						},
						{
							simplified: "Read the diary beside the leader.",
							simplifiedRequirements: ["Found in raid"],
							id: "find-leshy-diary",
							text: "Gather more information about the squad",
							optional: true,
							map: "The Labyrinth",
							items: [item("Leshy's diary", "68d2fd582ca1a737d107b84f")],
							note: "Find the diary in raid next to the squad leader by the torture room.",
							images: [image("leshy-s-diary-location-close", "The diary beside the squad leader")],
						},
						{
							simplified: "Read the five notes beside the scientists’ bodies.",
							simplifiedRequirements: ["Found in raid • Body 4 behind observation room door"],
							id: "investigate-scientists",
							text: "Investigate the 5 lab staff bodies",
							optional: true,
							map: "The Labyrinth",
							items: [
								item("Assistant's notes on Group #3", "68d2fa6d4aae290cf704e371"),
								item("Assistant's notes on Group #8", "68d2fa9b691b7c7b34046367"),
								item("Assistant's notes on Group #3 and Group #10", "68d2fac7c8305ec7c900296c"),
								item("Assistant's notes on Group #12", "68d2fa3abe7c1493b90cd3f9"),
								item("Assistant's notes on TG-Vi-24 test subjects", "68d2faf191c2fa84e2044a0b"),
								OBSERVATION_KEY,
							],
							note: "Pick up all five notes in raid beside the scientists' bodies. Body 4 (Group 12) is behind the observation room door.",
							images: [
								image("the-labyrinth-scientist-locations-map", "The five scientists marked on the map"),
								image("assistant-note-3-spawn", "Body 1: Group 3 notes under the right hand"),
								// Wiki captions identify these two notes in the opposite order to their filenames.
								image("assistant-note-3-and-10-spawn", "Body 2: Group 8 notes under the left arm"),
								image("assistant-note-8-spawn", "Body 3: Group 3 and Group 10 notes next to the body"),
								image("assistant-note-12-spawn", "Body 4: Group 12 notes under the body"),
								image("assistant-note-on-tg-vi-24-test-subject-spawn", "Body 5: TG-Vi-24 notes under the head"),
							],
						},
						{
							simplified: "Unlock the observation room.",
							id: "access-observation-room",
							text: "Access the locked office",
							optional: true,
							map: "The Labyrinth",
							items: [OBSERVATION_KEY],
							note: "The locked office is the observation room.",
							images: [
								image("observation-room-map", "Observation room marked on the map"),
								image("observation-room-door", "Door to the observation room"),
							],
						},
					],
				},
			],
		},
		{
			id: "scientist-tape",
			title: "Recover the scientist's audio tape",
			steps: [
				{
					simplified: "Take the tape beneath the scientist’s right hand in the observation room and listen.",
					simplifiedRequirements: ["Found in raid"],
					id: "listen-scientist-tape",
					text: "Listen to the audio tape from the office",
					map: "The Labyrinth",
					items: [AUDIO_TAPE, OBSERVATION_KEY],
					note: "Find the tape in raid on the ground under the scientist's right hand in the observation room, then listen to it.",
					images: [
						image("deceased-scientist-s-audio-tape-location-far", "The scientist in the observation room"),
						image("deceased-scientist-s-audio-tape-location-close", "The audio tape under the scientist's right hand"),
					],
				},
				{
					simplified: "Give Jaeger the tape.",
					id: "handover-scientist-tape",
					text: "Hand over the audio tape to Jaeger",
					items: [AUDIO_TAPE],
					note: "Through the trader screen.",
					rewardItems: [
						item("Accuracy International AXMC .338 LM bolt-action sniper rifle", "62973e474bb5ab23071c2a70"),
						item("AI AXMC .338 LM 10-round magazine", "628120fd5631d45211793c9f", 2),
						item(".338 Lapua Magnum FMJ ammo pack (20 pcs)", "657023ccbfc87b3a3409320a", 2),
					],
					rewards: [
						"500,000 roubles",
						"1× Accuracy International AXMC .338 LM bolt-action sniper rifle",
						"2× AI AXMC .338 LM 10-round magazine",
						"2× .338 Lapua Magnum FMJ ammo pack (20 pcs)",
					],
				},
			],
		},
		{
			id: "research-report",
			title: "Read the Labyrinth research report",
			steps: [
				{
					simplified: "Read the research report.",
					id: "read-research-report",
					text: "Read the Labyrinth facility research report",
					items: [RESEARCH_REPORT],
					note: "The report is major evidence for Mr. Kerman in The Ticket.",
					rewards: ["160,000 EXP", '"Theseus" achievement'],
					substeps: [
						{
							simplified: "Take the report by the drain pipe beside the pier.",
							simplifiedRequirements: ["Found in raid"],
							id: "obtain-research-report",
							text: "Locate and obtain the Labyrinth facility research report",
							optional: true,
							map: "Shoreline",
							items: [RESEARCH_REPORT],
							note: "Find it in raid at the drain pipe next to the pier.",
							images: [
								image("labyrinth-facility-research-report-location-map", "Report location marked on the map"),
								image("labyrinth-facility-research-report-location-far", "The drain pipe next to the pier"),
								image("labyrinth-facility-research-report-location-close", "The research report"),
							],
						},
					],
				},
			],
		},
	],
};
