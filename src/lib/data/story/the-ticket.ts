import type { StoryChapter, StoryCondition, StoryItemRef, StoryQuestRef } from "@/types/story";
import { MAJOR_EVIDENCE, MINOR_EVIDENCE } from "./evidence";

/**
 * The Ticket, reviewed against the EFT wiki on 2026-10-06. Items without an `id`
 * are story items absent from the item catalog.
 */

const item = (name: string, id?: string, count?: number, extra: Pick<StoryItemRef, "chapterId" | "note"> = {}) => ({
	name,
	...(id ? { id } : {}),
	...(count ? { count } : {}),
	...extra,
});

const caseGiven: StoryCondition = { decision: "falling-skies-armored-case", is: "gave-prapor" };
const caseKept: StoryCondition = { decision: "falling-skies-armored-case", is: "kept" };
const acceptedOffer: StoryCondition = { decision: "ticket-kerman-offer", is: "accept" };
const refusedOffer: StoryCondition = { decision: "ticket-kerman-offer", is: "refuse" };
const agreedEvidence: StoryCondition = { decision: "ticket-kerman-evidence", is: "agree" };
const refusedEvidence: StoryCondition = { decision: "ticket-kerman-evidence", is: "refuse" };
const deliveredAll: StoryCondition = { decision: "ticket-major-evidence", is: "deliver-all" };
const stoppedAfterTwo: StoryCondition = { decision: "ticket-major-evidence", is: "stop-after-two" };

const ARMORED_CASE = item("Armored case", "68fa8e253666e2fd5b00a626");
const KRUGLOV_KEYCARD = item("Kruglov's RFID keycard", "67bdea8667098e658f064695");
const ACTIVATED_KEYCARD = item("Activated Kruglov's RFID keycard", "67bdf04d66ca1d79a2024637");
const LABS_ACCESS = item("TerraGroup Labs access keycard", "5c94bbff86f7747ee735c08f");
const LABS_BLACK = item("TerraGroup Labs keycard (Black)", "5c1d0f4986f7744bb01837fa");
const STASH_KEY = item("Lighthouse island stash key", "6a8d581fe74010bf70069d83");
const BLUE_FOLDERS = item('TerraGroup "Blue Folders" materials', "6389c8c5dbfd5e4b95197e6b", 3);
const ALPHA_1 = item("Secure container Alpha-1 with TerraGroup evidence");

const QUESTS = {
	trustButVerify: { id: "custom-ttl-trust-but-verify", name: "To the Light - Trust but Verify" },
	gettingAcquainted: { id: "625d700cc48e6c62a440fab5", name: "To the Light - Getting Acquainted" },
	priceOfIndependenceA: { id: "6744af0969a58fceba101fed", name: "The Price of Independence" },
	priceOfIndependenceB: { id: "6745cbee909d2013670a4a55", name: "The Price of Independence (alternate)" },
	chooseYourFriends: { id: "67460662d0fbbc74ca0f7229", name: "Choose Your Friends Wisely" },
} satisfies Record<string, StoryQuestRef>;

const MILITARY_ELECTRONICS: StoryItemRef[] = [
	item("Iridium military thermal vision module", "5d0377ce86f774186372f689"),
	item("Military cable", "5d0375ff86f774186372f685"),
	item("Advanced current converter", "6389c85357baa773a825b356"),
	item("Far-forward GPS Signal Amplifier Unit", "6389c7f115805221fb410466"),
	item("Microcontroller board", "6389c7750ef44505c87f5996"),
	item("Military circuit board", "5d0376a486f7747d8050965c"),
	item("Military COFDM Wireless Signal Transmitter", "5c052f6886f7746b1e3db148"),
	item("Military gyrotachometer", "5d03784a86f774203e7e0c4d"),
	item("Military power filter", "5d0378d486f77420421a5ff4"),
	item("Phased array element", "5d03775b86f774203e7e0c4b"),
	item("UHF RFID Reader", "5c052fb986f7746b2101e909"),
	item("Virtex programmable processor", "5c05308086f7746b2101e90b"),
];

const AMULETS: Array<{ id: string; ordinal: string; amulet: string; key: StoryItemRef; map: string }> = [
	{
		id: "room-314",
		ordinal: "first",
		amulet: "Sacred Amulet from room 314",
		key: item("Dorm room 314 marked key", "5780cf7f2459777de4559322"),
		map: "Customs",
	},
	{
		id: "mysterious-room",
		ordinal: "second",
		amulet: "Sacred Amulet from the mysterious room",
		key: item("Abandoned factory marked key", "63a3a93f8a56922e82001f5d"),
		map: "Streets of Tarkov",
	},
	{
		id: "abandoned-factory",
		ordinal: "third",
		amulet: "Sacred Amulet from the abandoned factory",
		key: item("Mysterious room marked key", "64ccc25f95763a1ae376e447"),
		map: "Streets of Tarkov",
	},
	{
		id: "rb-vo",
		ordinal: "fourth",
		amulet: "Sacred Amulet from RB-VO",
		key: item("RB-VO marked key", "5d80c62a86f7744036212b3f"),
		map: "Reserve",
	},
	{
		id: "rb-pkpm",
		ordinal: "fifth",
		amulet: "Sacred Amulet from RB-PKPM",
		key: item("RB-PKPM marked key", "5ede7a8229445733cb4c18e2"),
		map: "Reserve",
	},
	{
		id: "rb-bk",
		ordinal: "sixth",
		amulet: "Sacred Amulet from RB-BK",
		key: item("RB-BK marked key", "5d80c60f86f77440373c4ece"),
		map: "Reserve",
	},
];

const TOPOGRAPHIC_MAPS: Array<{ id: string; name: string; map: string; key?: StoryItemRef }> = [
	{ id: "lighthouse", name: "Lighthouse topographic intel maps", map: "Lighthouse" },
	{ id: "woods", name: "Nature reserve topographic intel maps", map: "Woods" },
	{ id: "customs", name: "Customs topographic intel maps", map: "Customs" },
	{ id: "ground-zero", name: "City topographic intel maps", map: "Ground Zero" },
	{ id: "factory", name: "Factory plant topographic intel maps", map: "Factory" },
];

export const THE_TICKET: StoryChapter = {
	id: "the-ticket",
	name: "The Ticket",
	wikiLink: "https://escapefromtarkov.fandom.com/wiki/The_Ticket",
	banner: "/images/story/the-ticket/banner.webp",
	icon: "/images/story/the-ticket/icon.webp",
	summary: "Open Kruglov's armored case, choose who to trust, and escape Tarkov through the port Terminal.",
	previousChapterIds: ["falling-skies"],
	decisionIds: [
		"falling-skies-armored-case",
		"ticket-kerman-offer",
		"ticket-kerman-evidence",
		"ticket-major-evidence",
		"they-are-already-here-evidence",
		"ticket-prapor-deadline",
	],
	sections: [
		{
			id: "opening",
			title: "Contact Mr. Kerman",
			steps: [
				{ id: "intel-center-1", text: "Obtain Intelligence Center level 1" },
				{ id: "talk-kerman-1", text: "Talk to Mr. Kerman", note: "Use the Intelligence Center laptop." },
				{ id: "wait-kerman-1", text: "Wait for Mr. Kerman to reach out", note: "Takes 2–6 hours." },
				{ id: "talk-prapor-1", text: "Talk to Prapor", note: "Through the trader screen." },
				{ id: "talk-kerman-2", text: "Talk to Mr. Kerman" },
			],
		},
		{
			id: "recover-case",
			title: "Recover the armored case from Lightkeeper",
			when: caseGiven,
			steps: [
				{ id: "locate-prapor-camp", text: "Locate the camp of Prapor's people", map: "Lighthouse" },
				{
					id: "find-prapor-clues",
					text: "Find clues about Prapor's people's intentions",
					map: "Lighthouse",
					items: [item("Note from Prapor's men", "689b5093987b304021088e91")],
					note: "The note is in one of two places in the camp.",
				},
				{ id: "talk-kerman-3", text: "Talk to Mr. Kerman" },
				{
					id: "lightkeeper-access",
					text: "Gain access to Lightkeeper",
					map: "Lighthouse",
					requiresLightkeeper: true,
					items: [item("Digital secure DSP radio transmitter", "62e910aaf957f2915e0a5e36")],
					quests: [QUESTS.trustButVerify],
					note: "Third floor of the lighthouse. An encoded transmitter disarms the bridge claymores and stops Zryachiy shooting.",
					warning: "Harming Zryachiy, his followers or an acquainted PMC decodes your transmitter.",
				},
				{ id: "talk-lightkeeper-1", text: "Talk to Lightkeeper", requiresLightkeeper: true },
				{
					id: "lightkeeper-good-terms",
					text: "Stay on good terms with Lightkeeper",
					requiresLightkeeper: true,
					note: "Until he returns the armored case.",
				},
				{ id: "obtain-blue-folders", text: 'Obtain 3 TerraGroup "Blue Folders" materials', items: [BLUE_FOLDERS] },
				{
					id: "handover-blue-folders",
					text: "Bring the Blue Folders to Lightkeeper",
					requiresLightkeeper: true,
					items: [BLUE_FOLDERS],
				},
				{
					id: "interchange-flare",
					text: "Launch a yellow signal flare in front of ULTRA's main entrance",
					map: "Interchange",
					items: [
						item("RSP-30 reactive signal cartridge (Yellow)", "624c0b3340357b5f566e8766"),
						item("ZiD SP-81 26x75 signal pistol", "620109578d82e67e7911abf2"),
						item("26x75mm flare cartridge (Yellow)", "62389be94d5d474bf712e709"),
					],
					note: "Use an RSP-30 or a signal pistol with a yellow cartridge.",
				},
				{
					id: "interchange-kills",
					text: "Eliminate any 15 targets in one raid",
					map: "Interchange",
					note: "Transits are allowed, but the kills must happen on Interchange.",
					warning: "Extracting without the kills means redoing the flare as well.",
				},
				{
					id: "talk-lightkeeper-2",
					text: "Talk to Lightkeeper",
					requiresLightkeeper: true,
					note: "Keep a special slot free for the case.",
					rewards: ["Armored case"],
				},
			],
		},
		{
			id: "unlock-case",
			title: "Unlock the armored case",
			steps: [
				{ id: "ask-mechanic-help", text: "Ask Mechanic for help" },
				{
					id: "obtain-signal-jammer",
					text: "Obtain the experimental signal jammer",
					map: "The Lab",
					items: [item("Experimental signal jammer")],
					substeps: [
						{ id: "jammer-lab-access", text: "Gain access to The Lab", optional: true },
						{
							id: "jammer-labs-keycard",
							text: "Obtain the TerraGroup Labs access keycard",
							optional: true,
							items: [LABS_ACCESS],
						},
					],
				},
				{
					id: "unlock-armored-case",
					text: "Use the jammer to unlock the armored case",
					items: [ARMORED_CASE],
					note: "Craft at Workbench level 1.",
				},
				{
					id: "obtain-ticket",
					text: 'Obtain the "Ticket"',
					items: [KRUGLOV_KEYCARD],
					note: "Right-click the unlocked case and unpack it. The RFID card manual goes to your Handbook.",
					rewards: ["Unlocks the Armored case craft at Workbench level 1"],
				},
				{ id: "read-rfid-manual", text: "Read the RFID card manual", note: "It is a note in your Handbook." },
				{ id: "contact-kerman", text: "Contact Mr. Kerman", decision: "ticket-kerman-offer" },
			],
		},
		{
			id: "activate-keycard",
			title: "Activate the keycard with Mr. Kerman",
			endings: ["savior", "debtor", "fallen"],
			when: acceptedOffer,
			steps: [
				{
					id: "obtain-master-keycard",
					text: "Obtain the Laboratory master pass",
					map: "The Lab",
					items: [item("TerraGroup Labs master keycard"), LABS_BLACK],
					note: "Safe in Kruglov's office (R22); two Black keycard swipes open it. Move it to the quest inventory so you don't lose it.",
					substeps: [{ id: "master-lab-access", text: "Gain access to The Lab", optional: true }],
				},
				{
					id: "encryption-device-attempt",
					text: "Obtain an RFID card encryption device",
					map: "The Lab",
					note: "Scripted to fail: survive 30 minutes in total on The Lab, over any number of raids. Mr. Kerman then points you to Mechanic.",
				},
				{ id: "talk-kerman-4", text: "Talk to Mr. Kerman" },
				{ id: "talk-mechanic-2", text: "Talk to Mechanic", note: "He needs to contact a friend." },
				{ id: "wait-mechanic", text: "Wait for a response from Mechanic", note: "Takes 6–12 hours." },
				{
					id: "handover-bitcoin",
					text: "Hand over 40 Physical Bitcoins to Mechanic",
					items: [item("Physical Bitcoin", "59faff1d86f7746c51718c9c", 40)],
					note: "Not found-in-raid, but all 40 must be in your stash at once.",
					rewards: ["Elektronik's key", "Unlocks the Elektronik's key barter at Mechanic LL2"],
					substeps: [{ id: "bitcoin-farm-1", text: "Obtain Bitcoin Farm level 1", optional: true }],
				},
				{
					id: "collect-encryption-device",
					text: "Collect the RFID card encryption device",
					map: "Streets of Tarkov",
					items: [item("Elektronik's key", "68e95d71a3d110355b03e529"), item("RFID keycard encryption device")],
					note: "Under the coffee table in Elektronik's living room. It only spawns after the Bitcoin hand-in.",
					substeps: [
						{ id: "streets-access", text: "Gain access to Streets of Tarkov", optional: true },
						{
							id: "kruglov-apartment",
							text: "Access Kruglov's apartment",
							optional: true,
							map: "Streets of Tarkov",
							items: [item("Cardinal apartment key", "68c165f1903341d88b092b2a")],
						},
					],
				},
				{
					id: "activate-kruglov-keycard",
					text: "Activate Kruglov's RFID keycard",
					items: [ACTIVATED_KEYCARD],
					note: "Craft at Intelligence Center level 1.",
					substeps: [
						{ id: "activate-solar-1", text: "Obtain Solar Power level 1", optional: true },
						{
							id: "activate-blank-rfid",
							text: "Obtain a Blank RFID keycard",
							optional: true,
							items: [item("Blank RFID keycard", "67c031b79320f644db06f456")],
						},
					],
				},
				{ id: "arrive-terminal-1", text: "Arrive at the entrance pathway to the port Terminal", map: "Shoreline" },
				{
					id: "swipe-keycard-1",
					text: "Swipe the keycard at the intercom reader",
					map: "Shoreline",
					items: [ACTIVATED_KEYCARD],
					note: "Entry is refused; Mr. Kerman wants to talk.",
				},
				{ id: "talk-kerman-evidence", text: "Talk to Mr. Kerman", decision: "ticket-kerman-evidence" },
			],
		},
		{
			id: "survivor-prapor",
			title: "Buy your way out through Prapor",
			endings: ["survivor"],
			when: refusedOffer,
			steps: [
				{
					id: "arrive-terminal-survivor",
					text: "Arrive at the entrance pathway to the port Terminal",
					map: "Shoreline",
				},
				{
					id: "swipe-keycard-survivor",
					text: "Swipe the keycard at the intercom reader",
					map: "Shoreline",
					items: [ACTIVATED_KEYCARD],
					note: "Entry is refused.",
				},
				{
					id: "talk-prapor-survivor",
					text: "Talk to Prapor",
					rewards: ['"Easy Way" achievement'],
				},
				{
					id: "cash-prapor-300m",
					text: "Hand over 300,000,000 roubles to Prapor",
					when: caseGiven,
					items: [item("Roubles", "5449016a4bdc2d6f028b456f", 300_000_000)],
				},
				{
					id: "cash-prapor-500m",
					text: "Hand over 500,000,000 roubles to Prapor",
					when: caseKept,
					items: [item("Roubles", "5449016a4bdc2d6f028b456f", 500_000_000)],
				},
				{
					id: "prapor-evidence-ssd",
					text: "Save the evidence folders to an SSD",
					when: caseKept,
					items: [item("SSD with TerraGroup evidence")],
					note: "Prapor's three tasks run in order with a 72-hour limit. The SSD craft unlocks at Intelligence Center level 1.",
					substeps: [
						{
							id: "folder-reports",
							text: "Obtain the Folder with TerraGroup Labs evidence (Reports)",
							optional: true,
							map: "The Lab",
							items: [item("Folder with TerraGroup Labs evidence (Reports)")],
						},
						{
							id: "folder-staff",
							text: "Obtain the Folder with TerraGroup evidence (Staff)",
							optional: true,
							items: [item("Folder with TerraGroup evidence (Staff)")],
						},
						{
							id: "folder-developments",
							text: "Obtain the Folder with TerraGroup Labs evidence (Developments)",
							optional: true,
							items: [item("Folder with TerraGroup Labs evidence (Developments)")],
						},
						{
							id: "folder-finances",
							text: "Obtain the Folder with TerraGroup evidence (Finances)",
							optional: true,
							items: [item("Folder with TerraGroup evidence (Finances)")],
						},
					],
				},
				{
					id: "prapor-streets-kills",
					text: "Eliminate any 50 targets",
					map: "Streets of Tarkov",
					when: caseKept,
					note: "Across any number of raids.",
				},
				{
					id: "prapor-pmc-kills",
					text: "Eliminate 4 PMC operatives in one raid",
					when: caseKept,
					note: "Any map; transits are allowed.",
					rewards: ['"I am Speed" achievement, if within 72 hours'],
					decision: "ticket-prapor-deadline",
				},
				{
					id: "prapor-kappa",
					text: "Hand over Secure container Kappa to Prapor",
					when: { decision: "ticket-prapor-deadline", is: "missed" },
					items: [item("Secure container Kappa", "5c093ca986f7740a1867ab12")],
				},
				{
					id: "report-prapor-survivor",
					text: "Report to Prapor",
					rewards: ["Prapor's letter for the port checkpoint"],
					note: "Spare letters cost 5,000,000 roubles from Prapor, twice per restock.",
				},
			],
		},
		{
			id: "kerman-evidence",
			title: "Find dirt on TerraGroup",
			endings: ["savior", "debtor"],
			when: agreedEvidence,
			steps: [
				{ id: "intel-center-3", text: "Obtain Intelligence Center level 3", note: "Needed to send evidence." },
				{
					id: "second-chance",
					text: "Don't waste the second chance from Mr. Kerman",
					when: { decision: "they-are-already-here-evidence", is: "missed" },
				},
				{
					id: "deliver-major-evidence",
					text: "Deliver major TerraGroup evidence to Mr. Kerman",
					decision: "ticket-major-evidence",
					items: [...MAJOR_EVIDENCE],
					note: "Nine exist and Savior needs eight. Debtor stops after two: one is in the Cardinal apartment safe, the other needs another chapter.",
				},
				{
					id: "deliver-minor-evidence",
					text: "Deliver the 36 minor TerraGroup evidence",
					optional: true,
					items: [...MINOR_EVIDENCE],
					note: "Hand these in before confirming the major evidence; afterwards they are no longer accepted.",
					rewards: ['"Little Triumphs" achievement'],
				},
			],
		},
		{
			id: "savior-fence",
			title: "Complete Fence's assignments",
			endings: ["savior"],
			when: deliveredAll,
			steps: [
				{ id: "negotiate-kerman", text: "Negotiate with Mr. Kerman" },
				{
					id: "confirm-evidence",
					text: "Confirm with Mr. Kerman that all the evidence has been delivered",
					rewards: [ALPHA_1.name],
					warning: "Minor evidence can no longer be handed in after confirming.",
				},
				{
					id: "wait-kerman-contact",
					text: "Wait for Mr. Kerman's trusted contact to get in touch",
					note: "Fence contacts you after 12–24 hours.",
				},
				{ id: "talk-fence", text: "Talk to Fence" },
				{ id: "fence-rep-4", text: "Reach 4.0 reputation with Fence" },
				{ id: "fence-assignments", text: "Complete Fence's assignments" },
				{
					id: "keep-fence-rep",
					text: "Keep the standing with Fence above 4.0",
					note: "For the entire duration of the assignments.",
				},
				{
					id: "woods-coop-extract",
					text: "Extract through the Friendship Bridge (Co-Op)",
					map: "Woods",
					note: "Don't kill Scavs or the Goons; smoke grenades help lure Scavs to the extract. PvE: eliminate 5 PMCs on Interchange in one raid without killing Scavs.",
				},
				{
					id: "reserve-coop-extract",
					text: "Extract through the Scav Lands (Co-Op)",
					map: "Reserve",
					note: "Don't kill Scavs or the Goons. PvE: eliminate 5 PMCs on Shoreline in one raid without killing Scavs.",
				},
				{
					id: "btr-standing",
					text: "Reach 0.4 standing with the BTR Driver",
					quests: [QUESTS.priceOfIndependenceA, QUESTS.priceOfIndependenceB],
					note: "Complete The Price of Independence.",
					warning: "Completing Choose Your Friends Wisely fails this objective and ends the Savior route.",
				},
				{ id: "tell-fence-complete", text: "Tell Fence that the assignment is complete" },
				{
					id: "talk-fence-hash",
					text: "Talk to Fence",
					items: [item("Flash drive with Mr. Kerman's hash codes", "67c0345b354fca26a0008036")],
					note: "Fence mails you the flash drive.",
				},
				{
					id: "solar-power-savior",
					text: "Obtain Solar Power level 1",
					rewards: [
						"Unlocks the Reprogrammed RFID keycard with Mr. Kerman's hash codes craft at Intelligence Center level 1",
					],
				},
			],
		},
		{
			id: "debtor-lightkeeper",
			title: "Earn Lightkeeper's way out",
			endings: ["debtor"],
			when: stoppedAfterTwo,
			steps: [
				{
					id: "ask-traders-debtor",
					text: "Ask the traders how to leave Tarkov",
					requiresLightkeeper: true,
					quests: [QUESTS.gettingAcquainted],
					note: "Ask every trader, visiting Lightkeeper last.",
					rewards: ["Unlocks the Military flash drive with topographic intel craft at Intelligence Center level 1"],
				},
				{
					id: "topographic-flash-drive",
					text: "Hand over the military flash drive with compiled data to Lightkeeper",
					requiresLightkeeper: true,
					items: [item("Military flash drive with topographic intel")],
					note: "Craft at Intelligence Center level 1. Recraft it if you die carrying it.",
					substeps: [
						{
							id: "record-flash-drive",
							text: "Record the compiled data to a military flash drive",
							optional: true,
							items: [item("Military flash drive", "62a0a16d0b9d3c46de5b6e97")],
						},
						...TOPOGRAPHIC_MAPS.map((topo) => ({
							id: `topographic-${topo.id}`,
							text: `Obtain the ${topo.name}`,
							optional: true,
							map: topo.map,
							items: [item(topo.name)],
						})),
					],
				},
				{ id: "woods-pmc-kills", text: "Eliminate 30 PMCs", map: "Woods" },
				{
					id: "handover-dogtags",
					text: "Hand over 100 PMC dogtags to Lightkeeper",
					requiresLightkeeper: true,
					items: [item("PMC dogtag", undefined, 100)],
				},
				...AMULETS.map((amulet) => ({
					id: `stash-amulet-${amulet.id}`,
					text: `Stash the ${amulet.ordinal} amulet in the stash room`,
					map: "Lighthouse",
					items: [STASH_KEY],
					substeps: [
						{
							id: `obtain-amulet-${amulet.id}`,
							text: `Obtain the ${amulet.amulet}`,
							optional: true,
							map: amulet.map,
							items: [item(amulet.amulet), amulet.key],
							note: `Inside the ${amulet.key.name} room.`,
						},
					],
				})),
				{
					id: "report-lightkeeper-debtor",
					text: "Report to Lightkeeper",
					requiresLightkeeper: true,
					rewards: ["RFID keycard with unknown name", "Unlocks buying the keycard from Lightkeeper"],
					note: "Spare keycards cost 1 Blue Folders materials, once per raid; a free special slot is required.",
				},
			],
		},
		{
			id: "fallen-prapor",
			title: "Get Prapor's hash codes",
			endings: ["fallen"],
			when: refusedEvidence,
			steps: [
				{ id: "ask-traders-fallen", text: "Ask the traders how to leave Tarkov", note: "Then talk to Prapor." },
				{
					id: "prapor-electronics",
					text: "Hand over 50 military or advanced electronics to Prapor",
					when: caseKept,
					items: MILITARY_ELECTRONICS,
					note: "Any mix of the items below.",
				},
				{
					id: "prapor-secure-container",
					text: "Hand over Secure container Theta, Epsilon or Kappa to Prapor",
					when: caseKept,
					items: [
						item("Secure container Theta", "664a55d84a90fc2c8a6305c9"),
						item("Secure container Epsilon", "59db794186f77448bc595262"),
						item("Secure container Kappa", "5c093ca986f7740a1867ab12"),
					],
					note: "Any one of these.",
				},
				{
					id: "prapor-repair-kits",
					text: "Hand over 40 weapon or armor repair kits to Prapor",
					when: caseKept,
					items: [
						item("Weapon repair kit", "5910968f86f77425cf569c32"),
						item("Body armor repair kit", "591094e086f7747caa7bb2ef"),
					],
					note: "Any mix; despite the in-game hint, durability does not matter.",
				},
				{
					id: "dangerous-cargo",
					text: "Hand over the Case with dangerous cargo to Prapor",
					map: "Reserve",
					items: [item("Case with dangerous cargo"), item("RB-PKPTS key", "68e9654d72488961110dbf69")],
					note: "Inside the RB-PKPTS room.",
				},
				{ id: "report-prapor-fallen", text: "Report to Prapor" },
				{
					id: "usd-prapor",
					text: "Hand over 1,000,000 dollars to Prapor",
					items: [item("Dollars", "5696686a4bdc2da3298b456a", 1_000_000)],
					note: "The hand-over only appears once you have the full amount.",
					rewards: ['"Will It Blow?" achievement'],
				},
				{ id: "wait-prapor-fallen", text: "Wait for the info from Prapor", note: "Takes 18–24 hours." },
				{
					id: "collect-hash-codes",
					text: "Collect the updated hash codes from Prapor",
					items: [item("Flash drive with Prapor's hash codes", "67c04a9bd98287be7b0923d8")],
					rewards: [
						"Unlocks the Reprogrammed RFID keycard with Prapor's hash codes craft at Intelligence Center level 1",
					],
				},
				{ id: "solar-power-fallen", text: "Obtain Solar Power level 1" },
			],
		},
		{
			id: "terminal",
			title: "Escape through the Terminal",
			steps: [
				{
					id: "arrive-terminal-final",
					text: "Arrive at the entrance pathway to the port Terminal",
					map: "Shoreline",
					note: "The intercom on the watchtower only answers between 21:00 and 06:00.",
					substeps: [
						{
							id: "access-item-kerman",
							text: "Bring the Reprogrammed RFID keycard with Mr. Kerman's hash codes",
							optional: true,
							when: deliveredAll,
							items: [item("Reprogrammed RFID keycard with Mr. Kerman's hash codes", "67c033fd0610e91bea056998")],
						},
						{
							id: "access-item-unknown-name",
							text: "Bring the RFID keycard with unknown name",
							optional: true,
							when: stoppedAfterTwo,
							items: [item("RFID keycard with unknown name", "67c04dac9320f644db06f45c")],
						},
						{
							id: "access-item-prapor-letter",
							text: "Bring Prapor's letter for the port checkpoint",
							optional: true,
							when: refusedOffer,
							items: [item("Prapor's letter for the port checkpoint", "68f213f8ea61d1803707cf7a")],
							note: "Use the intercom call button.",
						},
						{
							id: "access-item-prapor-hash",
							text: "Bring the Reprogrammed RFID keycard with Prapor's hash codes",
							optional: true,
							when: refusedEvidence,
							items: [item("Reprogrammed RFID keycard with Prapor's hash codes", "67c04a6f9152fbdfa306cc66")],
						},
					],
				},
				{ id: "swipe-keycard-final", text: "Swipe the keycard at the intercom reader", map: "Shoreline" },
				{
					id: "access-terminal",
					text: "Access the port Terminal",
					note: "Follow the left road to the transit area; your weapon is lowered automatically.",
					warning:
						"Passing the first anti-tank barrier without an access item, leaving the road, or drawing a weapon gets you shot.",
					substeps: [
						{
							id: "bring-alpha-1",
							text: "Bring the Secure container Alpha-1 with TerraGroup evidence",
							optional: true,
							when: deliveredAll,
							items: [ALPHA_1],
							note: "Savior can't transit without it in the task inventory. A new one is mailed if you die with it.",
						},
					],
				},
				{ id: "pass-security-check", text: "Pass the security check", note: "A cinematic plays." },
				{
					id: "escape-tarkov",
					text: "Escape from Tarkov",
					map: "Terminal",
					note: "Dying or extracting restores your pre-Terminal state, minus the access item.",
					substeps: [
						{
							id: "terminal-armory",
							text: "Locate the armory with the confiscated equipment",
							optional: true,
							note: "The Armory key is on a dead RUAF soldier or a table along the way; gear is in a random locker. Black Division attacks as you leave.",
						},
						{
							id: "terminal-retrieve-alpha-1",
							text: "Retrieve the Secure container Alpha-1",
							optional: true,
							when: deliveredAll,
							note: "On the desk under the armory window.",
						},
						{
							id: "terminal-black-division-keycard",
							text: "Obtain the keycard to unlock the service passage",
							optional: true,
							items: [item("Black Division keycard", "6866ad3853330f9b83064cf9")],
							note: "Weapon box on a tipped-over ATM in the seaport building (MS), guarded by Black Division.",
						},
						{
							id: "terminal-loading-zone-exit",
							text: "Locate the exit leading to the Terminal loading zone",
							optional: true,
						},
						{
							id: "terminal-service-passage",
							text: "Unlock the service passage inside the seaport building",
							optional: true,
							note: "Swipe the keycard in the admin building (D3) after clearing Black Division at the entrance.",
						},
						{ id: "terminal-loading-zone", text: "Access the Terminal loading zone", optional: true },
						{
							id: "terminal-fuel-depot",
							text: "Locate the way into the fuel depot",
							optional: true,
							items: [item("SZ-1 explosive charge", "69a0174087a75d2cbd0842e8")],
							note: "Blow the gate with a nearby SZ-1 charge, or push it with Elite Strength or a second player.",
						},
						{
							id: "terminal-restore-power",
							text: "Restore power to the pumping station",
							optional: true,
							items: [item("Toolset", "590c2e1186f77425357b6124")],
							note: "Repair 1–5 electrical panels (one for solo players). A toolset guarantees the repair; two spawn past the gate.",
						},
						{ id: "terminal-panel-diagram", text: "Obtain the diagram of the electrical panels", optional: true },
						{ id: "terminal-drain-water", text: "Drain the water in the pumping station", optional: true },
						{
							id: "terminal-pier-key",
							text: "Obtain the key to the gate blocking the road to the pier",
							optional: true,
							items: [item("Pier door key", "6866adbe09b973bf45094339")],
							note: "In the pumping station safe, after draining the water.",
						},
						{ id: "terminal-pier-exit", text: "Locate the exit leading to the pier", optional: true },
						{
							id: "terminal-evacuation",
							text: "Reach the evacuation area at the pier",
							optional: true,
							note: "Opening the pier door starts a 3-minute timer to reach the Zubr boat.",
						},
					],
				},
			],
		},
	],
};
