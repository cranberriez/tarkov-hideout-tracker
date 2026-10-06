import type { StoryChapter, StoryItemRef } from "@/types/story";

/**
 * They Are Already Here, reviewed against the EFT wiki on 2026-10-06. Items without
 * an `id` are story items absent from the item catalog.
 */

const item = (name: string, id?: string, count?: number, extra: Pick<StoryItemRef, "chapterId" | "note"> = {}) => ({
	name,
	...(id ? { id } : {}),
	...(count ? { count } : {}),
	...extra,
});

const DORM_314_KEY = item("Dorm room 314 marked key", "5780cf7f2459777de4559322");
const ABANDONED_FACTORY_KEY = item("Abandoned factory marked key", "63a3a93f8a56922e82001f5d");
const RB_BK_KEY = item("RB-BK marked key", "5d80c60f86f77440373c4ece");
const RB_VO_KEY = item("RB-VO marked key", "5d80c62a86f7744036212b3f");
const RB_PKPM_KEY = item("RB-PKPM marked key", "5ede7a8229445733cb4c18e2");
const VICTIM_APARTMENT_KEY = item("Cult victim's apartment key", "68e96180901b9b10270f1eed");
const DAMAGED_PASS = item("Station 14-4 KORD Arshavin K. pass (Damaged)");
const RESTORED_PASS = item("Station 14-4 KORD Arshavin K. pass (Restored)", "68cc09872bdcc15c010c2668");
const ARRS_FLASH_DRIVE = item("Flash drive for ARRS station");

const EXTRACT_NOTE = 'Extract with "Survived" or "Run-Through".';

export const THEY_ARE_ALREADY_HERE: StoryChapter = {
	id: "they-are-already-here",
	name: "They Are Already Here",
	wikiLink: "https://escapefromtarkov.fandom.com/wiki/They_Are_Already_Here",
	banner: "/images/story/they-are-already-here/banner.webp",
	icon: "/images/story/they-are-already-here/icon.webp",
	summary:
		"Follow the cultists' Eye of the World across Tarkov to the hidden ARRS Station 14-4 KORD and cut it off from outside control.",
	previousChapterIds: [],
	decisionIds: ["they-are-already-here-evidence"],
	sections: [
		{
			id: "eye-of-the-world",
			title: "Follow the Eye of the World",
			steps: [
				{
					id: "learn-hooded-men",
					text: "Learn more about the people leaving strange symbols in Tarkov",
					items: [
						item("Note about the Eye of the World", "689b52ff147eeab4410ecd16"),
						DORM_314_KEY,
						RB_BK_KEY,
						RB_VO_KEY,
						RB_PKPM_KEY,
					],
					note: "Starts the chapter. Customs: dorm marked room (314). Reserve: the RB-BK, RB-VO or RB-PKPM marked rooms. Woods: marked circle in the dilapidated northern village. Shoreline: the house on the island.",
				},
				{
					id: "locate-eye-place",
					text: "Locate a place connected to the Eye of the World",
					map: "Lighthouse",
					note: "The cultists' torture house.",
				},
				{
					id: "torture-room-victim",
					text: "Learn more about the cultist's victim from the torture room",
					map: "Lighthouse",
					items: [item("Cult victim audio tape #2", "688893c5a030f9346505e6d5")],
					note: "On the chair; pick it up and listen. Must be found in raid.",
				},
			],
		},
		{
			id: "victim-apartment",
			title: "Investigate the victim's apartment",
			steps: [
				{
					id: "locate-victim-apartment",
					text: "Locate the cult victim's apartment",
					map: "Streets of Tarkov",
					items: [VICTIM_APARTMENT_KEY],
					note: "Apartment 5, third floor of the old building behind the Klimov mall.",
					substeps: [
						{
							id: "obtain-victim-apartment-key",
							text: "Obtain the key to the apartment",
							optional: true,
							map: "Lighthouse",
							items: [VICTIM_APARTMENT_KEY],
							note: "Four spawns in the torture house: fallen shelf, chair, wooden table or metal table.",
						},
					],
				},
				{
					id: "investigate-victim-apartment",
					text: "Investigate the victim's apartment",
					map: "Streets of Tarkov",
					items: [item("Note on preparations for the Arrival", "6877c834b52f568d4b0ea5a5")],
					note: "Breach the office door; the note is on the desk. Must be found in raid.",
				},
				{
					id: "victim-first-tape",
					text: "Obtain the victim's first audio tape",
					map: "Streets of Tarkov",
					items: [item("Cult victim audio tape #1", "6811e9119b009e592c07a59e")],
					note: "On the office desk; listen to it. Must be found in raid.",
				},
				{
					id: "book-of-arrival",
					text: "Obtain and read the book that the cultists planted with Igor",
					map: "Streets of Tarkov",
					items: [item("Book of the Arrival", "689b53222c175da5bf083ba3")],
					note: "On the office bookshelf. Must be found in raid.",
				},
			],
		},
		{
			id: "cultists",
			title: "Track down the cultists",
			steps: [
				{
					id: "ask-mechanic-eye",
					text: "Ask Mechanic about the Eye of the World",
					note: "Through the trader screen.",
					substeps: [{ id: "mechanic-access", text: "Gain access to Mechanic", optional: true }],
				},
				{ id: "kill-cultist-priest", text: "Locate and neutralize a Cultist priest", note: "Any map." },
				{
					id: "cultist-priest-note",
					text: "Obtain more information about the Eye of the World",
					items: [
						item("Cultist priest's note", "68ea9b43b8469178710c158e"),
						DORM_314_KEY,
						ABANDONED_FACTORY_KEY,
						RB_BK_KEY,
						RB_PKPM_KEY,
						RB_VO_KEY,
					],
					note: "In any one marked room: Customs dorm 314, the Streets abandoned factory, or Reserve RB-BK, RB-PKPM or RB-VO. It only spawns after the priest kill. Must be found in raid.",
				},
			],
		},
		{
			id: "marked-places",
			title: "Visit the places marked with the Eye of the World",
			steps: [
				{
					id: "eye-lighthouse",
					text: "Locate the place marked with the Eye of the World on Lighthouse",
					map: "Lighthouse",
					note: "Small southern bedroom, second floor of the northern blue chalet.",
				},
				{
					id: "ransacked-chalet-room",
					text: "Investigate the ransacked cultist room in the chalet",
					map: "Lighthouse",
					substeps: [
						{
							id: "victim-belongings",
							text: "Locate the victim's belongings",
							optional: true,
							map: "Lighthouse",
							items: [item("Victim's note", "689b53952b1ac3b0810b7fe0")],
							note: "On the adjacent balcony. Must be found in raid.",
						},
					],
				},
				{
					id: "obtain-damaged-pass",
					text: "Locate and obtain the key mentioned in the victim's note",
					map: "Lighthouse",
					items: [DAMAGED_PASS],
					note: "On the ATV in front of the garage opposite the chalet. Must be found in raid.",
				},
				{
					id: "eye-woods",
					text: "Locate the place marked with the Eye of the World on Woods",
					map: "Woods",
					note: "A house in the dilapidated northern village.",
				},
				{
					id: "cultists-house",
					text: "Investigate the cultists' house marked with the Eye of the World",
					map: "Woods",
					items: [item("Newspaper clipping from the cultists' house", "689b53b7127673bbd40706d3")],
					note: "On the whiteboard next to the desk. Must be found in raid.",
				},
				{
					id: "eye-shoreline",
					text: "Locate the place marked with the Eye of the World on Shoreline",
					map: "Shoreline",
					note: 'Red metal shack at the radio tower near the "Road to Customs" extract.',
				},
				{
					id: "sordi-tower-area",
					text: "Investigate the area around the Sordi communications tower",
					map: "Shoreline",
					items: [item("Programmer's note", "689b536a4b553916720119aa")],
					note: "At the right hand of a body next to the tower. Must be found in raid.",
				},
				{
					id: "repair-sordi-tower",
					text: "Repair the Sordi tower",
					map: "Shoreline",
					items: [item("Toolset", "590c2e1186f77425357b6124")],
					note: "Use the toolset inside the shack; it is consumed.",
				},
			],
		},
		{
			id: "station-kord",
			title: "Infiltrate Station 14-4 KORD",
			steps: [
				{
					id: "ask-mechanic-kord",
					text: "Learn more about Station 14-4 KORD from Mechanic",
					note: "Ask him about the Eye of the World again.",
				},
				{
					id: "restore-arshavin-pass",
					text: "Restore Arshavin's keycard",
					items: [RESTORED_PASS, DAMAGED_PASS],
					note: "Craft at Intelligence Center level 1; the craft stops if power goes out.",
				},
				{
					id: "access-cobalt-facility",
					text: "Gain access to NGO Cobalt's secret facility",
					map: "Interchange",
					items: [RESTORED_PASS],
					note: "Basement of the power station.",
				},
				{
					id: "restore-station-power",
					text: "Restore power at the station",
					map: "Interchange",
					items: [RESTORED_PASS],
					note: "Swipe the pass at the panel next to the entrance door.",
				},
				{
					id: "turn-on-cooling",
					text: "Turn on the cooling system in the server room",
					map: "Interchange",
					note: "Flip the lever at the back, behind the grate door.",
				},
				{
					id: "install-flash-drive",
					text: "Install a flash drive to download the data",
					map: "Interchange",
					items: [item("Secure Flash drive", "590c621186f774138d11ea29")],
					note: "Stash it to the left of the cooling lever.",
				},
				{
					id: "investigate-kord",
					text: "Investigate ARRS Station 14-4 KORD thoroughly",
					map: "Interchange",
					items: [item("Mysterious audio tape", "688895322f6b5b76380e6af5")],
					note: "In the safe next to the entrance; it opens once cooling is on. Must be found in raid.",
				},
				{
					id: "extract-interchange-1",
					text: "Survive and extract from Interchange",
					map: "Interchange",
					note: EXTRACT_NOTE,
				},
			],
		},
		{
			id: "arrs-station",
			title: "Disconnect the ARRS station",
			steps: [
				{
					id: "arrs-mechanic-notes",
					text: "Find a way to disconnect the station from external agents",
					map: "Interchange",
					items: [item("ARRS station mechanic's notes")],
					note: "Return to the facility; the notes are on the big desk. Must be found in raid.",
				},
				{
					id: "restore-backup-settings",
					text: "Restore the ARRS station to backup settings",
					map: "Interchange",
					note: "Turn the power on again and press the button under the server room table. Only one player per raid can press it; if you can't interact, try a new raid.",
					substeps: [{ id: "check-station-power", text: "Check that the station power is turned on", optional: true }],
				},
				{
					id: "collect-arrs-flash-drive",
					text: "Collect the flash drive from the ARRS station",
					map: "Interchange",
					items: [ARRS_FLASH_DRIVE],
					note: "On the server next to the cooling lever. Must be found in raid.",
					warning:
						"Collecting it before restoring the backup settings loses the ARRS system specifications major evidence.",
					decision: "they-are-already-here-evidence",
				},
				{
					id: "extract-interchange-2",
					text: "Survive and extract from Interchange",
					map: "Interchange",
					note: EXTRACT_NOTE,
				},
				{
					id: "handover-arrs-flash-drive",
					text: "Hand over the flash drive with data to Mechanic",
					items: [ARRS_FLASH_DRIVE],
				},
				{
					id: "read-arrs-specs",
					text: "Read the ARRS station specifications",
					items: [item("ARRS system specifications", "689b53ef987b304021088e95")],
					note: "It is a note in your Handbook.",
					rewards: ["128,000 EXP", '"Through Another\'s Eyes" achievement', '"When the Light Fades" achievement'],
				},
			],
		},
	],
};
