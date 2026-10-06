import type { StoryChapter } from "@/types/story";
import { chapterImage, item } from "./helpers";

/**
 * They Are Already Here, reviewed against the EFT wiki on 2026-10-06. Items without
 * an `id` are story items absent from the item catalog. Step images are wiki screenshots.
 */

const image = chapterImage("they-are-already-here");

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
					simplified:
						"Visit a marked site: Customs 314, Reserve RB-BK / RB-VO / RB-PKPM, Woods’ northern village or Shoreline’s island house.",
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
					images: [
						image("customs-activation-location", "Customs: the note on a stack of books in dorm 314"),
						image("reserve-activation-location-1", "Reserve: RB-BK, on the table with the pig carcass"),
						image("reserve-activation-location-2", "Reserve: RB-VO, on the table with the pig carcass"),
						image("reserve-activation-location-3", "Reserve: RB-PKPM, on the desk"),
						image("woods-activation-location-map", "Woods: marked circle on the map"),
						image("woods-ritual-spot", "Woods: the marked circle"),
						image("woods-activation-location", "Woods: the note next to the burning candles"),
						image("shoreline-island-map", "Shoreline: island marked on the map"),
						image("shoreline-activation-location", "Shoreline: the note on the floor in the house"),
					],
				},
				{
					simplified: "Find the cultists’ torture house.",
					id: "locate-eye-place",
					text: "Locate a place connected to the Eye of the World",
					map: "Lighthouse",
					note: "The cultists' torture house.",
					images: [
						image("torture-house-map", "House location marked on the map"),
						image("torture-house", "The torture house"),
					],
				},
				{
					simplified: "Take the tape from the chair and listen.",
					simplifiedRequirements: ["Found in raid"],
					id: "torture-room-victim",
					text: "Learn more about the cultist's victim from the torture room",
					map: "Lighthouse",
					items: [item("Cult victim audio tape #2", "688893c5a030f9346505e6d5")],
					note: "On the chair; pick it up and listen. Must be found in raid.",
					images: [image("cult-victim-audio-tape-2-spawn", "The tape on the chair")],
				},
			],
		},
		{
			id: "victim-apartment",
			title: "Investigate the victim's apartment",
			steps: [
				{
					simplified: "Find apartment 5 on the third floor behind Klimov mall.",
					id: "locate-victim-apartment",
					text: "Locate the cult victim's apartment",
					map: "Streets of Tarkov",
					items: [VICTIM_APARTMENT_KEY],
					note: "Apartment 5, third floor of the old building behind the Klimov mall.",
					images: [
						image("cult-victims-apartment-map", "Building location marked on the map"),
						image("cult-victims-apartment-building", "The old apartment building"),
						image("cult-victims-apartment-door", "Door to apartment 5"),
					],
					substeps: [
						{
							simplified: "Take the key from the torture house’s fallen shelf, chair or tables.",
							id: "obtain-victim-apartment-key",
							text: "Obtain the key to the apartment",
							optional: true,
							map: "Lighthouse",
							items: [VICTIM_APARTMENT_KEY],
							note: "Four spawns in the torture house: fallen shelf, chair, wooden table or metal table.",
							images: [
								image("cult-victims-apartment-key-spawn-4", "Spawn 1: on the fallen shelf"),
								image("cult-victims-apartment-key-spawn-1", "Spawn 2: on the chair"),
								image("cult-victims-apartment-key-spawn-2", "Spawn 3: on the wooden table"),
								image("cult-victims-apartment-key-spawn-3", "Spawn 4: on the metal table"),
							],
						},
					],
				},
				{
					simplified: "Breach the office door and read the desk note.",
					simplifiedRequirements: ["Found in raid"],
					id: "investigate-victim-apartment",
					text: "Investigate the victim's apartment",
					map: "Streets of Tarkov",
					items: [item("Note on preparations for the Arrival", "6877c834b52f568d4b0ea5a5")],
					note: "Breach the office door; the note is on the desk. Must be found in raid.",
					images: [
						image("cult-victim-apartment-office", "Door to the office"),
						image("note-on-preparations-for-the-arrival-spawn", "The note on the desk"),
					],
				},
				{
					simplified: "Take the tape from the office desk and listen.",
					simplifiedRequirements: ["Found in raid"],
					id: "victim-first-tape",
					text: "Obtain the victim's first audio tape",
					map: "Streets of Tarkov",
					items: [item("Cult victim audio tape #1", "6811e9119b009e592c07a59e")],
					note: "On the office desk; listen to it. Must be found in raid.",
					images: [image("cult-victim-audio-tape-1-spawn", "The tape on the desk")],
				},
				{
					simplified: "Read the book on the office bookshelf.",
					simplifiedRequirements: ["Found in raid"],
					id: "book-of-arrival",
					text: "Obtain and read the book that the cultists planted with Igor",
					map: "Streets of Tarkov",
					items: [item("Book of the Arrival", "689b53222c175da5bf083ba3")],
					note: "On the office bookshelf. Must be found in raid.",
					images: [image("book-of-the-arrival-spawn", "The book on the bookshelf")],
				},
			],
		},
		{
			id: "cultists",
			title: "Track down the cultists",
			steps: [
				{
					simplified: "Ask Mechanic about the Eye of the World.",
					id: "ask-mechanic-eye",
					text: "Ask Mechanic about the Eye of the World",
					note: "Through the trader screen.",
					substeps: [
						{
							simplified: false,
							id: "mechanic-access",
							text: "Gain access to Mechanic",
							optional: true,
						},
					],
				},
				{
					simplified: "Kill a Cultist priest on any map.",
					id: "kill-cultist-priest",
					text: "Locate and neutralize a Cultist priest",
					note: "Any map.",
				},
				{
					simplified:
						"After killing the priest, read the note in Customs 314, Streets’ abandoned factory or Reserve RB-BK / RB-PKPM / RB-VO.",
					simplifiedRequirements: ["Found in raid"],
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
					images: [
						image("customs-dorm-314-map", "Customs: dorm 314 marked on the map"),
						image("customs-dorm-314-door", "Customs: door to dorm 314"),
						image("cultist-priest-note-customs-spawn", "Customs: the note on a stack of books"),
						image("streets-abandoned-factory-map", "Streets of Tarkov: marked room location on the map"),
						image("streets-abandoned-factory-door", "Streets of Tarkov: door to the marked room"),
						image("cultist-priest-note-streets-spawn", "Streets of Tarkov: the note on the floor"),
						image("rb-bk-map", "Reserve: RB-BK marked on the map"),
						image("rb-bk-door", "Reserve: door to RB-BK"),
						image("cultist-priest-note-rb-bk-spawn", "Reserve: RB-BK, the note on the bookshelf"),
						image("rb-pkpm-map", "Reserve: RB-PKPM marked on the underground map"),
						image("rb-pkpm-door", "Reserve: door to RB-PKPM"),
						image("cultist-priest-note-rb-pkpm-spawn", "Reserve: RB-PKPM, the note on the fallen bookshelf"),
						image("rb-vo-map", "Reserve: RB-VO marked on the map"),
						image("rb-vo-door", "Reserve: door to RB-VO"),
						image("cultist-priest-note-rb-vo-spawn", "Reserve: RB-VO, the note on the bookshelf"),
					],
				},
			],
		},
		{
			id: "marked-places",
			title: "Visit the places marked with the Eye of the World",
			steps: [
				{
					simplified: "Find the small south bedroom upstairs in the northern blue chalet.",
					id: "eye-lighthouse",
					text: "Locate the place marked with the Eye of the World on Lighthouse",
					map: "Lighthouse",
					note: "Small southern bedroom, second floor of the northern blue chalet.",
					images: [image("blue-chalet-map", "Chalet location marked on the map")],
				},
				{
					simplified: "Search the chalet bedroom.",
					id: "ransacked-chalet-room",
					text: "Investigate the ransacked cultist room in the chalet",
					map: "Lighthouse",
					substeps: [
						{
							simplified: "Take the belongings from the adjoining balcony.",
							simplifiedRequirements: ["Found in raid"],
							id: "victim-belongings",
							text: "Locate the victim's belongings",
							optional: true,
							map: "Lighthouse",
							items: [item("Victim's note", "689b53952b1ac3b0810b7fe0")],
							note: "On the adjacent balcony. Must be found in raid.",
							images: [image("victims-note-spawn", "The note on the balcony")],
						},
					],
				},
				{
					simplified: "Take the pass from the ATV by the garage opposite the chalet.",
					simplifiedRequirements: ["Found in raid"],
					id: "obtain-damaged-pass",
					text: "Locate and obtain the key mentioned in the victim's note",
					map: "Lighthouse",
					items: [DAMAGED_PASS],
					note: "On the ATV in front of the garage opposite the chalet. Must be found in raid.",
					images: [image("damaged-pass-spawn", "The pass on the ATV")],
				},
				{
					simplified: "Find the marked house in the ruined northern village.",
					id: "eye-woods",
					text: "Locate the place marked with the Eye of the World on Woods",
					map: "Woods",
					note: "A house in the dilapidated northern village.",
					images: [
						image("woods-cultists-house-map", "House location marked on the map"),
						image("woods-cultists-house", "The house"),
					],
				},
				{
					simplified: "Read the note on the whiteboard beside the desk.",
					simplifiedRequirements: ["Found in raid"],
					id: "cultists-house",
					text: "Investigate the cultists' house marked with the Eye of the World",
					map: "Woods",
					items: [item("Newspaper clipping from the cultists' house", "689b53b7127673bbd40706d3")],
					note: "On the whiteboard next to the desk. Must be found in raid.",
					images: [image("woods-cultists-house-newspaper", "The clipping on the whiteboard")],
				},
				{
					simplified: "Find the red shack at the radio tower near Road to Customs.",
					id: "eye-shoreline",
					text: "Locate the place marked with the Eye of the World on Shoreline",
					map: "Shoreline",
					note: 'Red metal shack at the radio tower near the "Road to Customs" extract.',
					images: [
						image("shoreline-radio-tower-map", "Radio tower location marked on the map"),
						image("shoreline-radio-tower", "The radio tower"),
						image("shoreline-radio-tower-shack", "The shack"),
					],
				},
				{
					simplified: "Take the document beside the body’s right hand.",
					simplifiedRequirements: ["Found in raid"],
					id: "sordi-tower-area",
					text: "Investigate the area around the Sordi communications tower",
					map: "Shoreline",
					items: [item("Programmer's note", "689b536a4b553916720119aa")],
					note: "At the right hand of a body next to the tower. Must be found in raid.",
					images: [
						image("shoreline-dead-body-location", "Location of the body"),
						image("programmers-note-spawn", "The note at the body's right hand"),
					],
				},
				{
					simplified: "Repair the tower inside the shack.",
					simplifiedRequirements: ["Toolset consumed"],
					id: "repair-sordi-tower",
					text: "Repair the Sordi tower",
					map: "Shoreline",
					items: [item("Toolset", "590c2e1186f77425357b6124")],
					note: "Use the toolset inside the shack; it is consumed.",
					images: [image("sordi-tower-repair-location", "Repair spot in the shack")],
				},
			],
		},
		{
			id: "station-kord",
			title: "Infiltrate Station 14-4 KORD",
			steps: [
				{
					simplified: "Ask Mechanic about the Eye again.",
					id: "ask-mechanic-kord",
					text: "Learn more about Station 14-4 KORD from Mechanic",
					note: "Ask him about the Eye of the World again.",
				},
				{
					simplified: "Craft the restored pass.",
					simplifiedRequirements: ["Intelligence Center 1 • Continuous power"],
					id: "restore-arshavin-pass",
					text: "Restore Arshavin's keycard",
					items: [RESTORED_PASS, DAMAGED_PASS],
					note: "Craft at Intelligence Center level 1; the craft stops if power goes out.",
				},
				{
					simplified: "Enter the power-station basement.",
					id: "access-cobalt-facility",
					text: "Gain access to NGO Cobalt's secret facility",
					map: "Interchange",
					items: [RESTORED_PASS],
					note: "Basement of the power station.",
					images: [
						image("power-station-map", "Power station marked on the map"),
						image("interchange-power-station", "The power station"),
						image("power-station-stairs-door", "Door to the basement stairs"),
						image("station-kord-door", "Door to the secret facility"),
					],
				},
				{
					simplified: "Swipe the pass at the entrance panel.",
					id: "restore-station-power",
					text: "Restore power at the station",
					map: "Interchange",
					items: [RESTORED_PASS],
					note: "Swipe the pass at the panel next to the entrance door.",
					images: [image("station-kord-keycard-reader", "The keycard panel")],
				},
				{
					simplified: "Flip the cooling lever behind the grate door.",
					id: "turn-on-cooling",
					text: "Turn on the cooling system in the server room",
					map: "Interchange",
					note: "Flip the lever at the back, behind the grate door.",
					images: [
						image("station-kord-grate-door", "The grate door"),
						image("station-kord-cooling-lever", "The lever"),
					],
				},
				{
					simplified: "Stash the drive left of the cooling lever.",
					id: "install-flash-drive",
					text: "Install a flash drive to download the data",
					map: "Interchange",
					items: [item("Secure Flash drive", "590c621186f774138d11ea29")],
					note: "Stash it to the left of the cooling lever.",
					images: [image("station-kord-flash-drive-plant", "The stash spot")],
				},
				{
					simplified: "Read the document in the entrance safe after turning on cooling.",
					simplifiedRequirements: ["Found in raid"],
					id: "investigate-kord",
					text: "Investigate ARRS Station 14-4 KORD thoroughly",
					map: "Interchange",
					items: [item("Mysterious audio tape", "688895322f6b5b76380e6af5")],
					note: "In the safe next to the entrance; it opens once cooling is on. Must be found in raid.",
					images: [image("mysterious-audio-tape-spawn", "The tape in the safe")],
				},
				{
					simplified: "Extract from Interchange.",
					simplifiedRequirements: ["Survived or Run-Through counts"],
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
					simplified: "Return to the facility and read the notes on the large desk.",
					simplifiedRequirements: ["Found in raid"],
					id: "arrs-mechanic-notes",
					text: "Find a way to disconnect the station from external agents",
					map: "Interchange",
					items: [item("ARRS station mechanic's notes")],
					note: "Return to the facility; the notes are on the big desk. Must be found in raid.",
					images: [image("arrs-mechanic-notes-spawn", "The notes on the desk")],
				},
				{
					simplified: "Turn power on and press the button under the server-room table.",
					simplifiedRequirements: ["One player per raid • Retry in a new raid if unavailable"],
					id: "restore-backup-settings",
					text: "Restore the ARRS station to backup settings",
					map: "Interchange",
					note: "Turn the power on again and press the button under the server room table. Only one player per raid can press it; if you can't interact, try a new raid.",
					images: [image("arrs-disconnect-button", "The button")],
					substeps: [
						{
							simplified: false,
							id: "check-station-power",
							text: "Check that the station power is turned on",
							optional: true,
						},
					],
				},
				{
					simplified: "Take the drive from the server beside the cooling lever.",
					simplifiedRequirements: ["Found in raid"],
					id: "collect-arrs-flash-drive",
					text: "Collect the flash drive from the ARRS station",
					map: "Interchange",
					items: [ARRS_FLASH_DRIVE],
					note: "On the server next to the cooling lever. Must be found in raid.",
					warning:
						"Collecting it before restoring the backup settings loses the ARRS system specifications major evidence.",
					decision: "they-are-already-here-evidence",
					images: [image("arrs-flash-drive-spawn", "The flash drive")],
				},
				{
					simplified: "Extract from Interchange.",
					simplifiedRequirements: ["Survived or Run-Through counts"],
					id: "extract-interchange-2",
					text: "Survive and extract from Interchange",
					map: "Interchange",
					note: EXTRACT_NOTE,
				},
				{
					simplified: "Hand over the flash drive with data to Mechanic",
					id: "handover-arrs-flash-drive",
					text: "Hand over the flash drive with data to Mechanic",
					items: [ARRS_FLASH_DRIVE],
				},
				{
					simplified: "Read the specifications in your Handbook.",
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
