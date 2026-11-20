/**
 * Season 2 (UNTAR Control) modifiers, transcribed from Battlestate's English modifier poster.
 * Icons are cropped from the poster into public/images/season-2/modifiers/<id>.webp.
 * See ./types.ts for ID, sign and comparison rules.
 */
import { personal, type SeasonModifierSet } from "./types";

type Entry = { id: string; name: string; effects: string[] };
type PersonalEntry = Entry & { points: number };

const GLOBAL: Entry[] = [
	{
		id: "untar-control",
		name: "UNTAR Control",
		effects: [
			"UN troops appear throughout Tarkov. They're hostile to all Scavs, as well as to PMCs who break the rules",
			"UN troops control various areas across locations",
		],
	},
	{
		id: "tough-times",
		name: "Tough Times",
		effects: [
			"Access to extracts from locations is limited",
			"At the start of the season, player Scav cooldown is significantly increased",
		],
	},
	{
		id: "peace-market",
		name: "Peace Market",
		effects: [
			"Flea Market becomes available to all players after completing a new global task",
			"Minimal restrictions on listing items",
		],
	},
	{ id: "no-insurance", name: "No Insurance", effects: ["Insurance is unavailable"] },
	{
		id: "supply-shortage",
		name: "Supply Shortage",
		effects: ["Tarkov is experiencing shortages of food, medical supplies, large backpacks, and explosives"],
	},
	{ id: "smart-pmcs", name: "Smart PMCs", effects: ["Skill progression speed is increased by 25%"] },
];

/** Poster order: rows left to right, three per row. */
const POSITIVE: PersonalEntry[] = [
	{
		id: "lockpicker",
		name: "Lockpicker",
		points: -1,
		effects: ["Unlock the ability to pick padlocks on doors and containers using a multitool"],
	},
	{
		id: "introvert",
		name: "Introvert",
		points: -1,
		effects: ["Skill progression speed is increased by 30% when playing solo"],
	},
	{
		id: "tap-rack-roll",
		name: "Tap, Rack, Roll",
		points: -1,
		effects: ["Start with the Troubleshooting skill at level 40", "Malfunction clearing no longer requires inspection"],
	},
	{
		id: "enhanced-secure-container",
		name: "Enhanced Secure Container",
		points: -2,
		effects: [
			"Start with Secure Container Epsilon X with the ability to retain the FIR status of items inside even after death",
		],
	},
	{
		id: "fast-crafting",
		name: "Fast Crafting",
		points: -2,
		effects: ["Start with the Crafting skill at level 40", "This skill's progression speed is increased by 100%"],
	},
	{
		id: "refs-builders",
		name: "Ref's Builders",
		points: -2,
		effects: ["Build Hideout zones with GP coins and Lega Medals"],
	},
	{
		id: "kleptomaniac",
		name: "Kleptomaniac",
		points: -2,
		effects: ["Start with the Search skill at level 40", "This skill's progression speed is increased by 100%"],
	},
	{
		id: "friends-extract",
		name: "Friend's Extract",
		points: -2,
		effects: ["One additional Scav extract is available in every PMC raid (if the location has them)"],
	},
	{
		id: "heavyweight",
		name: "Heavyweight",
		points: -2,
		effects: [
			"Movement speed is reduced by 5%",
			"Maximum carry weight is increased by 30 kg (Overweight threshold increased by 5 kg)",
		],
	},
	{
		id: "cold-blooded",
		name: "Cold-Blooded",
		points: -4,
		effects: ["Your in-raid body temperature is lower, making you significantly harder to see with thermal optics"],
	},
	{
		id: "advanced-hideout",
		name: "Advanced Hideout",
		points: -4,
		effects: ["Start with pre-built Hideout zones: Bitcoin Farm, Gym, Scav Case, and more"],
	},
	{
		id: "peacekeepers-insurance",
		name: "Peacekeeper's Insurance",
		points: -4,
		effects: ["Peacekeeper provides gear insurance service for Euros"],
	},
	{
		id: "marathon-runner",
		name: "Marathon Runner",
		points: -5,
		effects: ["Arm and leg stamina is consumed 25% slower"],
	},
	{
		id: "safecracker",
		name: "Safecracker",
		points: -4,
		effects: ["Mechanical keys and keycards have a 50% chance not to lose durability when used"],
	},
	{
		id: "bushborne",
		name: "Bushborne",
		points: -4,
		effects: ["Walking in vegetation generates 75% less noise and doesn't inflict movement slowdown"],
	},
	{
		id: "juice-time",
		name: "Juice Time",
		points: -1,
		effects: ["Consuming a juice drink grants the Painkiller effect for 240 seconds"],
	},
	{
		id: "sailors-nostalgia",
		name: "Sailor's Nostalgia",
		points: -2,
		effects: ["Consuming canned fish grants the Health Regeneration (+1) effect for 600 seconds"],
	},
	{
		id: "youth",
		name: "Youth",
		points: -6,
		effects: ["Energy is consumed 20% slower", "Arm and leg stamina is increased by 25 points"],
	},
	{ id: "street-tax", name: "Street Tax", points: -2, effects: ["Once per week, some Scavs pay you for protection"] },
	{
		id: "the-tarkov-shooter",
		name: "The Tarkov Shooter",
		points: -2,
		effects: ["Start with the Bolt-action Rifles skill at level 51"],
	},
	{ id: "diet", name: "Diet", points: -1, effects: ["All provisions consume 50% less resource"] },
	{
		id: "hercules",
		name: "Hercules",
		points: -6,
		effects: ["Start with the Strength and Endurance skills at level 20"],
	},
	{ id: "sprinter", name: "Sprinter", points: -4, effects: ["Running speed is increased by 15%"] },
	{ id: "thrombophilia", name: "Thrombophilia", points: -6, effects: ["Bleeding chance is decreased by 100%"] },
	{ id: "prodigy", name: "Prodigy", points: -4, effects: ["Skill progression speed is increased by 20%"] },
	{ id: "hypodipsia", name: "Hypodipsia", points: -2, effects: ["Hydration is consumed 50% slower"] },
	{ id: "polyphagia", name: "Polyphagia", points: -2, effects: ["Energy is consumed 45% slower"] },
	{
		id: "sturdy-bones",
		name: "Sturdy Bones",
		points: -2,
		effects: ["Limb fracture chance is decreased by 50%", "Falling from heights deals 30% less damage"],
	},
	{
		id: "average",
		name: "Average",
		points: -8,
		effects: ["All character skills are set to level 30 but cannot be leveled further"],
	},
	{ id: "kappa-protocol", name: "Kappa Protocol", points: -8, effects: ["Start with Secure container Kappa"] },
	{ id: "lucky", name: "Lucky", points: -1, effects: ["Audentes fortuna iuvat!"] },
];

/** Poster order: rows left to right, three per row. */
const NEGATIVE: PersonalEntry[] = [
	{
		id: "extrovert",
		name: "Extrovert",
		points: 3,
		effects: ["Skill progression speed is decreased by 30% when playing solo"],
	},
	{ id: "schizo", name: "Schizo", points: 2, effects: ["Your character occasionally hears phantom sounds"] },
	{ id: "no-repairs", name: "No Repairs", points: 2, effects: ["Items cannot be repaired through traders"] },
	{
		id: "loose-tongue",
		name: "Loose Tongue",
		points: 2,
		effects: ["Your character occasionally does a voice line after performing any action"],
	},
	{
		id: "three-fingered",
		name: "Three-Fingered",
		points: 2,
		effects: ["15% chance of dropping a magazine when reloading"],
	},
	{ id: "no-love-from-fence", name: "No Love From Fence", points: 2, effects: ["Start with Fence reputation at -7.0"] },
	{
		id: "zero-to-hero",
		name: "Zero to Hero",
		points: 2,
		effects: ["Start with a completely empty character, no bonus items"],
	},
	{
		id: "shaky-aim",
		name: "Shaky Aim",
		points: 3,
		effects: ["Aiming for more than 3 seconds causes hand tremors, pain, and tunnel vision"],
	},
	{ id: "no-scav-runs", name: "No Scav Runs", points: 3, effects: ["Unable to play as a Scav"] },
	{
		id: "deadline",
		name: "Deadline",
		points: 4,
		effects: [
			"You must reach any ending within 30 days. Failure to meet the deadline results in a wipe for the seasonal character",
		],
	},
	{
		id: "coagulopathy",
		name: "Coagulopathy",
		points: 3,
		effects: ["Any bleeding immediately becomes a Heavy Bleeding"],
	},
	{ id: "hemophilia", name: "Hemophilia", points: 2, effects: ["Bleeding chance is increased by 70%"] },
	{
		id: "osteoporosis",
		name: "Osteoporosis",
		points: 2,
		effects: ["Limb fracture chance is increased by 50%", "Falling from heights deals 50% more damage"],
	},
	{ id: "exhaustion", name: "Exhaustion", points: 5, effects: ["Arm and leg stamina is reduced by 20 points"] },
	{ id: "well-that-hurt", name: "Well That Hurt!", points: 1, effects: ["All medkit uses consume 33% more resource"] },
	{ id: "incompetent", name: "Incompetent", points: 8, effects: ["Skill progression speed is decreased by 100%"] },
	{ id: "polydipsia", name: "Polydipsia", points: 1, effects: ["Hydration is consumed 25% faster"] },
	{
		id: "chronic-fatigue-syndrome",
		name: "Chronic Fatigue Syndrome",
		points: 1,
		effects: ["Energy is consumed 20% faster"],
	},
	{
		id: "personality-vacuum",
		name: "Personality Vacuum",
		points: 6,
		effects: ["Charisma skill cannot be increased", "All trader items and services cost 50% more"],
	},
	{
		id: "dr-jekyll",
		name: "Dr. Jekyll",
		points: 2,
		effects: ["After gaining the Fresh Wound status, it cannot be removed until the end of the raid"],
	},
	{
		id: "allergic",
		name: "Allergic",
		points: 2,
		effects: ["Become allergic to 4 random items from the Provisions or Medication category"],
	},
	{
		id: "broken-secure-container",
		name: "Broken Secure Container",
		points: 6,
		effects: [
			"Secure container can only be filled with cash, keys, dogtags, stimulants, special equipment, certain containers, and Battle Pass documents",
		],
	},
	{
		id: "no-flea-market",
		name: "No Flea Market",
		points: 8,
		effects: ["Trading with players on the Flea Market is disabled"],
	},
	{
		id: "third-leg",
		name: "Third Leg",
		points: 1,
		effects: ["Movement speed is decreased by 2%", "Buying items at Therapist is 5% cheaper"],
	},
	{ id: "unlucky", name: "Unlucky", points: 1, effects: ["Your bad luck can sometimes have dire consequences"] },
];

const icon = (id: string) => `/images/season-2/modifiers/${id}.webp`;

/** Season 1 values where the derived "was" number alone would be unclear. */
const PREVIOUS_NOTES: Record<string, string> = {
	"sturdy-bones": "25% fracture chance, 20% fall damage",
	osteoporosis: "25% fracture chance, 20% fall damage",
	youth: "10 stamina",
	"the-tarkov-shooter": "level 25 start, 100% faster leveling",
	incompetent: "25% slower leveling, level 30 cap",
	exhaustion: "20% slower recovery, −10 stamina",
	"sailors-nostalgia": "+2 regen for 30s",
	"personality-vacuum": "20% higher trader prices",
	safecracker: "25%, keys only",
	bushborne: "slowdown reduced, not removed",
	"broken-secure-container": "no stimulants",
	allergic: "3 items",
	"third-leg": "1% slower movement",
};

export const SEASON_2_MODIFIERS: SeasonModifierSet = {
	seasonId: "season-2",
	source: { label: "Battlestate Games Season 2 modifier poster" },
	note: "Modifier values may be adjusted before the start of the season for balancing purposes.",
	// APPEND-ONLY bit order for `?b=` share links: add new IDs at the end, never reorder or remove.
	shareOrder: [
		"lockpicker",
		"introvert",
		"tap-rack-roll",
		"enhanced-secure-container",
		"fast-crafting",
		"refs-builders",
		"kleptomaniac",
		"friends-extract",
		"heavyweight",
		"cold-blooded",
		"advanced-hideout",
		"peacekeepers-insurance",
		"marathon-runner",
		"safecracker",
		"bushborne",
		"juice-time",
		"sailors-nostalgia",
		"youth",
		"street-tax",
		"the-tarkov-shooter",
		"diet",
		"hercules",
		"sprinter",
		"thrombophilia",
		"prodigy",
		"hypodipsia",
		"polyphagia",
		"sturdy-bones",
		"average",
		"kappa-protocol",
		"lucky",
		"extrovert",
		"schizo",
		"no-repairs",
		"loose-tongue",
		"three-fingered",
		"no-love-from-fence",
		"zero-to-hero",
		"shaky-aim",
		"no-scav-runs",
		"deadline",
		"coagulopathy",
		"hemophilia",
		"osteoporosis",
		"exhaustion",
		"well-that-hurt",
		"incompetent",
		"polydipsia",
		"chronic-fatigue-syndrome",
		"personality-vacuum",
		"dr-jekyll",
		"allergic",
		"broken-secure-container",
		"no-flea-market",
		"third-leg",
		"unlucky",
	],
	modifiers: [
		...GLOBAL.map((entry) => ({ ...entry, kind: "global" as const, icon: icon(entry.id) })),
		...personal("positive", POSITIVE, icon),
		...personal("negative", NEGATIVE, icon),
	].map((modifier) =>
		PREVIOUS_NOTES[modifier.id] ? { ...modifier, previousNote: PREVIOUS_NOTES[modifier.id] } : modifier,
	),
};
