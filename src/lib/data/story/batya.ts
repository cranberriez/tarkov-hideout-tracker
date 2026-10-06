import type { StoryChapter, StoryImage, StoryItemRef, StoryQuestRef } from "@/types/story";

/**
 * Batya, reviewed against the EFT wiki on 2026-10-06. Items without an `id`
 * are story items absent from the item catalog. Step images are wiki screenshots.
 */

const item = (name: string, id?: string, count?: number, extra: Pick<StoryItemRef, "chapterId" | "note"> = {}) => ({
	name,
	...(id ? { id } : {}),
	...(count ? { count } : {}),
	...extra,
});

const image = (file: string, caption: string): StoryImage => ({
	src: `/images/story/batya/steps/${file}.webp`,
	thumb: `/images/story/batya/steps/thumbs/${file}.webp`,
	caption,
});

const PATCH = item("Bogatyrs patch");
const STRELETS_AMULET = item("Strelets' amulet");
const TARAN_POSTCARD = item("Taran's postcard");
// The quest item; the catalog's "Voevoda's audio recorder" is the chapter reward.
const VOEVODA_RECORDER = item("Voevoda's audio recorder");
const MOREMAN_DOGTAG = item("Moreman's dogtag");
const MOREMAN_PHONE = item("Moreman's phone");
const DORM_314_KEY = item("Dorm room 314 marked key", "5780cf7f2459777de4559322");

const QUESTS = {
	trustButVerify: { id: "custom-ttl-trust-but-verify", name: "To the Light - Trust but Verify" },
} satisfies Record<string, StoryQuestRef>;

const KEEPSAKE_NOTE = "Move it to the quest inventory; Lightkeeper wants it later.";
const RADIO_NOTE = 'Intelligence Center radio: frequency "35.70", then code "27.893.2000".';
const RADIO_IMAGES = [
	image("intel-center-radio-1", "The radio system"),
	image("intel-center-radio-2", 'Enter frequency "35.70"'),
	image("intel-center-radio-3", 'Enter code "27.893.2000"'),
];

export const BATYA: StoryChapter = {
	id: "batya",
	name: "Batya",
	wikiLink: "https://escapefromtarkov.fandom.com/wiki/Batya",
	banner: "/images/story/batya/banner.webp",
	icon: "/images/story/batya/icon.webp",
	summary: "Trace the BEAR Bogatyr squad across its outposts, reach Voevoda by radio, and hunt down who betrayed them.",
	previousChapterIds: [],
	decisionIds: [],
	sections: [
		{
			id: "bogatyr-trail",
			title: "Find the Bogatyr squad's trail",
			steps: [
				{
					id: "visit-start-location",
					text: "Visit a place the BEAR special squad passed through",
					note: 'Starts the chapter. Customs: mattress under the "жопа" writing, Scav base second floor. Reserve: radome on the white queen radar station. Shoreline: bunker north of the health resort. Woods: mattresses on the big rock at the USEC camp.',
					images: [
						image("customs-scav-base-map", "Customs: Scav base marked on the map"),
						image("zb-013-building", "Customs: the Scav base"),
						image("batya-customs-activation-location", "Customs: the mattress"),
						image("radar-station-map", "Reserve: radar station marked on the map"),
						image("reserve-radar-station", "Reserve: the radar station"),
						image("shoreline-bunker-map", "Shoreline: bunker marked on the map"),
						image("shoreline-bunker", "Shoreline: the bunker"),
						image("batya-woods-activation-map", "Woods: rock marked on the map"),
						image("batya-woods-activation-location", "Woods: the mattresses"),
					],
				},
				{
					id: "locate-bear-traces",
					text: "Locate the traces of the BEAR special squad",
					items: [PATCH],
					note: "Pick up and read the patch. Customs: couch in the hilltop cabin southwest of the new gas station. Woods: by the convoy BRDM. Reserve: package on the white king airspace control center roof. Lighthouse: sleeping bag in the BEAR camp. Must be found in raid.",
					images: [
						image("bogatyrs-patch-customs-map", "Customs: cabin marked on the map"),
						image("bogatyrs-patch-customs-cabin", "Customs: the cabin"),
						image("bogatyrs-patch-customs-spawn", "Customs: the patch on the couch"),
						image("bogatyrs-patch-woods-map", "Woods: convoy marked on the map"),
						image("bogatyrs-patch-woods-brdm", "Woods: the BRDM"),
						image("bogatyrs-patch-woods-spawn", "Woods: the patch next to the BRDM"),
						image("bogatyrs-patch-reserve-map", "Reserve: white king airspace control center marked on the map"),
						image("bogatyrs-patch-reserve-spawn", "Reserve: the patch on the package"),
						image("bogatyrs-patch-lighthouse-map", "Lighthouse: BEAR camp marked on the map"),
						image("bogatyrs-patch-lighthouse-bear-camp", "Lighthouse: the camp"),
						image("bogatyrs-patch-lighthouse-spawn", "Lighthouse: the patch on the sleeping bag"),
					],
					substeps: [
						{
							id: "obtain-bogatyr-patch",
							text: "Locate and obtain the Bogatyr squad patch",
							optional: true,
							items: [PATCH],
							note: KEEPSAKE_NOTE,
						},
					],
				},
				{
					id: "ask-jaeger",
					text: "Learn more about the Bogatyr squad from the traders",
					note: "Ask Jaeger about the patch.",
				},
			],
		},
		{
			id: "ryabina",
			title: "Search the Ryabina outpost",
			steps: [
				{
					id: "locate-ryabina",
					text: "Locate the Ryabina outpost",
					map: "Woods",
					note: "North of the sawmill.",
					images: [
						image("ryabina-outpost-map", "Outpost location marked on the map"),
						image("ryabina-outpost", "The outpost"),
					],
				},
				{
					id: "ryabina-information",
					text: "Find more information about the Bogatyr squad",
					map: "Woods",
					items: [item("Hostage evacuation report from Voevoda", "68d3037c91c2fa84e2044a0d")],
					note: "On a pallet next to a bottle in the camp. Must be found in raid.",
					images: [image("hostage-evacuation-report-spawn", "The report on a pallet next to a bottle")],
					substeps: [
						{
							id: "obtain-strelets-amulet",
							text: "Locate and obtain a keepsake of one of the Bogatyrs",
							optional: true,
							map: "Woods",
							items: [STRELETS_AMULET],
							note: `Green crate at the sniper nest next to the camp. ${KEEPSAKE_NOTE}`,
							images: [
								image("strelets-amulet-sniper-nest", "The sniper nest next to the camp"),
								image("strelets-amulet-spawn", "The amulet on a green crate"),
							],
						},
					],
				},
			],
		},
		{
			id: "carousel",
			title: "Search the Carousel outpost",
			steps: [
				{
					id: "locate-carousel",
					text: "Locate the Carousel outpost",
					map: "Interchange",
					note: "Opposite the IDEA checkout area inside ULTRA.",
					images: [
						image("carousel-outpost-map", "Outpost location marked on the map"),
						image("carousel-outpost", "The outpost"),
					],
				},
				{
					id: "bogatyr-personal-notes",
					text: "Find the Bogatyr squad's personal notes",
					map: "Interchange",
					items: [item("Strelets' note", "68d2f85af63f06b7590ce310")],
					note: "Next to the bottles by the armchair, second floor. Must be found in raid.",
					images: [image("strelets-note-spawn", "The note next to the bottles by the armchair")],
				},
				{
					id: "learn-strelets",
					text: "Learn more about Strelets",
					map: "Interchange",
					items: [item("Strelets' personnel file", "68d305fc8c12620073059936")],
					note: "On the armchair, second floor. Must be found in raid.",
					images: [image("strelets-personnel-file-spawn", "The file on the armchair")],
				},
				{
					id: "learn-taran",
					text: "Learn more about Taran",
					map: "Interchange",
					items: [item("Taran's personnel file", "68d305c35f98276b7503c336")],
					note: "Between the beds. Must be found in raid.",
					images: [image("taran-personnel-file-spawn", "The file between the beds")],
					substeps: [
						{
							id: "obtain-taran-postcard",
							text: "Locate and obtain a personal item of one of the Bogatyrs",
							optional: true,
							map: "Interchange",
							items: [TARAN_POSTCARD],
							note: `On the floor next to the beds. ${KEEPSAKE_NOTE}`,
							images: [image("taran-postcard-spawn", "The postcard on the floor next to the beds")],
						},
					],
				},
				{
					id: "learn-voevoda",
					text: "Learn more about Voevoda",
					map: "Interchange",
					items: [item("Voevoda's personnel file", "68d3059318d70f97e704ad7f")],
					note: "On a desk, second floor. Must be found in raid.",
					images: [image("voevoda-personnel-file-spawn", "The file on a desk")],
				},
				{
					id: "voevoda-belongings",
					text: "Find Voevoda's personal belongings",
					map: "Interchange",
					items: [item("Voevoda's thoughts audio tape", "6888965ac122cae7a20765fa")],
					note: "On the table with the radio system. Must be found in raid.",
					images: [image("voevoda-thoughts-audio-tape-spawn", "The tape on the table with the radio system")],
					substeps: [
						{
							id: "obtain-voevoda-recorder",
							text: "Locate and obtain the squad commander's recorder",
							optional: true,
							map: "Interchange",
							items: [VOEVODA_RECORDER],
							note: `On the table with the radio system. ${KEEPSAKE_NOTE}`,
							images: [image("voevoda-audio-recorder-spawn", "The recorder on the table with the radio system")],
						},
					],
				},
			],
		},
		{
			id: "gnezdo",
			title: "Search the Gnezdo outpost",
			steps: [
				{
					id: "locate-gnezdo",
					text: "Locate the Gnezdo outpost",
					map: "Interchange",
					note: "East of ULTRA.",
					images: [
						image("gnezdo-outpost-map", "Outpost location marked on the map"),
						image("gnezdo-outpost", "The outpost"),
					],
				},
				{
					id: "search-gnezdo",
					text: "Search the Gnezdo outpost",
					map: "Interchange",
					items: [
						item("First piece of code note", "68d2f69e91c2fa84e2044a08"),
						item("Audio tape with report", "6888958794cca0a80b070ae9"),
					],
					note: "Note on the pallet with the green cloth; tape on the radio table in the tent. Must be found in raid.",
					images: [
						image("gnezdo-first-piece-of-code-note", "The note on the pallet with the green cloth"),
						image("gnezdo-audio-tape-with-report", "The tape on the table with the radio system in the tent"),
					],
				},
				{
					id: "bogatyr-fate",
					text: "Figure out what happened to the Bogatyr squad",
					map: "Interchange",
					items: [item("BEAR note from the outpost behind Ultra", "68d2f7334aae290cf704e36d")],
					note: "Blue chair next to the fire barrel. Must be found in raid.",
					images: [image("gnezdo-bear-note", "The note on the blue chair next to the fire barrel")],
				},
				{
					id: "ambush-location",
					text: "Figure out where the Bogatyr squad got ambushed",
					map: "Interchange",
					items: [item("Map with triangulated signal", "68d2f77e5f98276b7503c330")],
					note: "Sleeping bag under the rock. Must be found in raid.",
					images: [image("gnezdo-map-with-triangulated-signal", "The map in the sleeping bag under the rock")],
				},
				{
					id: "bogatyr-activities",
					text: "Learn more about the Bogatyr squad's activities",
					map: "Interchange",
					items: [item("Bogatyr squad operations report", "68d302814aae290cf704e375")],
					note: "Next to the guitar under the rock. Must be found in raid.",
					images: [image("gnezdo-bogatyr-squad-operations-report", "The report next to the guitar under the rock")],
				},
				{
					id: "bogatyr-members",
					text: "Learn more about the Bogatyr squad's members",
					map: "Interchange",
					items: [item("Moreman's personnel file", "68d3054f0c834c20c00a81da")],
					note: "On one of the beds in the tent. Must be found in raid.",
					images: [image("gnezdo-moreman-personnel-file", "The file on one of the beds in the tent")],
				},
			],
		},
		{
			id: "ambush",
			title: "Find the ambush spot",
			steps: [
				{
					id: "locate-ambush",
					text: "Locate the ambush spot",
					map: "Woods",
					note: "Moreman's grave near the ZB-016 extract in the east.",
					images: [
						image("batya-woods-ambush-spot-map", "Grave location marked on the map"),
						image("batya-woods-ambush-spot", "The grave"),
					],
				},
				{
					id: "ambush-information",
					text: "Obtain more information about the Bogatyr squad",
					map: "Woods",
					note: "Read the note and take the phone and dogtag from the grave.",
				},
				{
					id: "inspect-moreman",
					text: "Inspect Moreman's body",
					map: "Woods",
					items: [item("Second piece of code note", "68d2f6dbf8817df4690db3d3")],
					note: "In one of the boots. Must be found in raid.",
					images: [image("second-piece-of-code-note-spawn", "The note in one of the boots")],
					substeps: [
						{
							id: "obtain-moreman-phone",
							text: "Locate and obtain Moreman's phone",
							optional: true,
							map: "Woods",
							items: [MOREMAN_PHONE],
							note: "On the ground next to the cross.",
							images: [image("moreman-phone-spawn", "The phone next to the cross")],
						},
						{
							id: "obtain-moreman-dogtag",
							text: "Locate and obtain a dogtag of one of the Bogatyrs",
							optional: true,
							map: "Woods",
							items: [MOREMAN_DOGTAG],
							note: `On the sleeping bag next to the cross. ${KEEPSAKE_NOTE}`,
							images: [image("moreman-dogtag-spawn", "The dogtag on the sleeping bag next to the cross")],
						},
					],
				},
				{
					id: "moreman-phone-recordings",
					text: "Retrieve more information about the ambush from Moreman's phone",
					items: [item("Moreman's audio tape #1"), item("Moreman's audio tape #2")],
					note: "Craft both tapes at Workbench level 1 and listen to them; the craft stops if power goes out.",
				},
			],
		},
		{
			id: "contact-bogatyrs",
			title: "Contact the Bogatyr squad",
			steps: [
				{ id: "intel-center-3", text: "Obtain Intelligence Center level 3" },
				{
					id: "radio-bogatyrs",
					text: "Contact the Bogatyr squad",
					note: `${RADIO_NOTE} The codes come from the two code notes and Strelets' note.`,
					images: RADIO_IMAGES,
				},
				{
					id: "lightkeeper-access",
					text: "Gain access to Lightkeeper",
					map: "Lighthouse",
					requiresLightkeeper: true,
					items: [item("Digital secure DSP radio transmitter", "62e910aaf957f2915e0a5e36")],
					quests: [QUESTS.trustButVerify],
					note: "Third floor of the lighthouse. An encoded transmitter disarms the bridge claymores and stops Zryachiy shooting.",
					warning: "Harming Zryachiy, his followers or an acquainted PMC decodes your transmitter.",
					images: [
						image("lightkeeper-map", "Lighthouse location marked on the map"),
						image("lightkeeper-area-door", "The locked area door"),
					],
				},
				{ id: "lightkeeper-good-terms", text: "Stay on good terms with Lightkeeper", requiresLightkeeper: true },
				{
					id: "handover-bogatyr-items",
					text: "Bring all the Bogatyr squad's items to Lightkeeper",
					map: "Lighthouse",
					requiresLightkeeper: true,
					items: [TARAN_POSTCARD, VOEVODA_RECORDER, STRELETS_AMULET, MOREMAN_DOGTAG, PATCH],
					note: "Carry them in the in-raid quest inventory. Must be found in raid.",
				},
				{
					id: "wait-voevoda",
					text: "Wait for Voevoda to reach out",
					note: `Takes 6–12 hours, then use the radio again. ${RADIO_NOTE}`,
					images: RADIO_IMAGES,
				},
			],
		},
		{
			id: "voevoda-tasks",
			title: "Complete Voevoda's tasks",
			steps: [
				{ id: "skill-lmg-5", text: "Reach Light Machine Guns skill level 5" },
				{ id: "skill-assault-10", text: "Reach Assault Rifles skill level 10" },
				{ id: "skill-stress-10", text: "Reach Stress Resistance skill level 10" },
				{ id: "skill-strength-15", text: "Reach Strength skill level 15" },
				{ id: "kills-no-death", text: "Eliminate any 15 targets without dying" },
				{ id: "pmc-kills-no-death", text: "Eliminate 4 PMC operatives without dying" },
				{ id: "contact-voevoda", text: "Contact Voevoda", note: RADIO_NOTE, images: RADIO_IMAGES },
			],
		},
		{
			id: "traitors",
			title: "Hunt the traitors",
			steps: [
				{
					id: "traitor-traces",
					text: "Locate the traces of the traitors",
					map: "Lighthouse",
					items: [item("Note mentioning Prapor", "68d2f96e0c834c20c00a81d8")],
					note: "On the radio table in the Lighthouse BEAR camp. Must be found in raid.",
					images: [
						image("bogatyrs-patch-lighthouse-map", "BEAR camp location marked on the map"),
						image("bogatyrs-patch-lighthouse-bear-camp", "The camp"),
						image("note-mentioning-prapor-spawn", "The note on the table with the radio system"),
					],
					substeps: [
						{
							id: "investigate-reserve-bunker",
							text: "Investigate the command bunker",
							optional: true,
							map: "Reserve",
						},
						{
							id: "investigate-lighthouse-camp",
							text: "Investigate the BEAR camp",
							optional: true,
							map: "Lighthouse",
						},
						{
							id: "investigate-interchange-camp",
							text: "Investigate the BEAR camp east of ULTRA",
							optional: true,
							map: "Interchange",
						},
					],
				},
				{ id: "interrogate-prapor", text: "Interrogate Prapor", note: "Through the trader screen." },
				{
					id: "cultists-general",
					text: "Figure out how the cultists are connected to the General",
					items: [
						item("Voevoda's photo with a cultist mark", "68d2f9164aae290cf704e36f"),
						item("Note mentioning General", "68d2f9bd2ca1a737d107b84d"),
						DORM_314_KEY,
					],
					note: "Shoreline: the photo is on the floor of the island house. The note is by the candles at the marked circle west of the Woods sawmill, or on the wall of the Customs marked room (dorm 314 key). Must be found in raid.",
					images: [
						image("shoreline-island-map", "Shoreline: island marked on the map"),
						image("voevoda-photo-spawn", "Shoreline: the photo on the floor"),
						image("woods-southern-marked-circle-map", "Woods: marked circle on the map"),
						image("woods-cultists-ritual-place", "Woods: the marked circle"),
						image("note-mentioning-general-woods-spawn", "Woods: the note next to the candles"),
						image("customs-dorm-314-map", "Customs: marked room location on the map"),
						image("customs-dorm-314-door", "Customs: door to the marked room"),
						image("note-mentioning-general-customs-spawn", "Customs: the note on the wall"),
					],
				},
				{ id: "talk-lightkeeper", text: "Talk to Lightkeeper", map: "Lighthouse", requiresLightkeeper: true },
				{
					id: "unheard-documents",
					text: "Wait for Lightkeeper to prepare the documents on The Unheard",
					map: "Lighthouse",
					requiresLightkeeper: true,
					items: [item("Agent network deployment report", "68d3041818d70f97e704ad7b")],
					note: "In a new raid, read it on the red wooden box in Lightkeeper's area. Completes 6 hours later. Must be found in raid.",
					rewards: ["144,000 EXP", "Voevoda's audio recorder", '"This Is All (Not) Coincidence" achievement'],
				},
			],
		},
	],
};
