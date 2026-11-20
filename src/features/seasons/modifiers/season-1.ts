/**
 * Season 1 (KORD Breach) modifiers. Text and points come from Tarkov Market's transcription of the
 * season preview (read 2026-11-19), so live values may differ. Pick rates are Battlestate's published
 * top five per group. See ./types.ts for ID, sign and comparison rules.
 *
 * Icons: every personal modifier returns in Season 2 with the same artwork (confirmed for the ten
 * pick-rate entries), so they reuse the Season 2 crops. Global modifier art (128px, supplied by the
 * maintainer) lives in public/images/season-1/modifiers/<id>.webp.
 */
import { personal, type SeasonModifier, type SeasonModifierSet } from "./types";

const sharedIcon = (id: string) => `/images/season-2/modifiers/${id}.webp`;
const globalIcon = (id: string) => `/images/season-1/modifiers/${id}.webp`;

const PICK_RATES: Record<string, number> = {
	lucky: 42.56,
	hercules: 41.32,
	"street-tax": 41.18,
	prodigy: 40.69,
	"marathon-runner": 40.36,
	allergic: 44.2,
	polydipsia: 43.8,
	osteoporosis: 43.72,
	"third-leg": 42,
	"well-that-hurt": 41.8,
};

const POSITIVE = [
	{
		id: "marathon-runner",
		name: "Marathon Runner",
		points: -3,
		effects: ["Arm and leg stamina is consumed 20% slower"],
	},
	{
		id: "bushborne",
		name: "Bushborne",
		points: -5,
		effects: ["Walking in vegetation generates 75% less noise and movement slowdown"],
	},
	{
		id: "juice-time",
		name: "Juice Time",
		points: -2,
		effects: ["Consuming a juice drink grants the Painkiller effect for 60 seconds"],
	},
	{ id: "street-tax", name: "Street Tax", points: -1, effects: ["Once per week, some Scavs pay you protection money"] },
	{
		id: "the-tarkov-shooter",
		name: "The Tarkov Shooter",
		points: -2,
		effects: [
			"Bolt-action Rifles skill leveling speed is increased by 100%",
			"Bolt-action Rifles skill starts at level 25",
		],
	},
	{ id: "diet", name: "Diet", points: -2, effects: ["All provisions consume 50% less resource"] },
	{ id: "thrombophilia", name: "Thrombophilia", points: -2, effects: ["Bleeding chance is decreased by 25%"] },
	{ id: "hypodipsia", name: "Hypodipsia", points: -2, effects: ["Hydration is consumed 20% slower"] },
	{ id: "polyphagia", name: "Polyphagia", points: -2, effects: ["Energy is consumed 20% slower"] },
	{
		id: "sturdy-bones",
		name: "Sturdy Bones",
		points: -3,
		effects: ["Limb fracture chance is decreased by 25%", "Falling from heights deals 20% less damage"],
	},
	{
		id: "average",
		name: "Average",
		points: -12,
		effects: ["All character skills are set to level 25 but cannot be leveled further (Excluding Crafting skill)"],
	},
	{
		id: "kappa-protocol",
		name: "Kappa Protocol",
		points: -12,
		effects: ["Immediately receive Secure container Kappa"],
	},
	{ id: "prodigy", name: "Prodigy", points: -5, effects: ["Skill experience gain is increased by 30%"] },
	{ id: "lucky", name: "Lucky", points: -1, effects: ["Audentes fortuna iuvat!"] },
	{
		id: "safecracker",
		name: "Safecracker",
		points: -5,
		effects: ["Mechanical keys have a 25% chance not to lose durability when used"],
	},
	{
		id: "sailors-nostalgia",
		name: "Sailor's Nostalgia",
		points: -2,
		effects: ["Consuming canned fish grants the Health Regeneration (+2) effect for 30 seconds"],
	},
	{
		id: "youth",
		name: "Youth",
		points: -5,
		effects: ["Energy is consumed 20% slower", "Arm and leg stamina is increased by 10"],
	},
	{ id: "hercules", name: "Hercules", points: -5, effects: ["Strength and Endurance skills start at level 15"] },
	{ id: "sprinter", name: "Sprinter", points: -3, effects: ["Running speed is increased by 5%"] },
];

const NEGATIVE = [
	{ id: "hemophilia", name: "Hemophilia", points: 2, effects: ["Bleeding chance is increased by 25%"] },
	{
		id: "osteoporosis",
		name: "Osteoporosis",
		points: 3,
		effects: ["Limb fracture chance is increased by 25%", "Falling from heights deals 20% more damage"],
	},
	{ id: "well-that-hurt", name: "Well That Hurt!", points: 2, effects: ["All medkit uses consume 25% more resource"] },
	{
		id: "incompetent",
		name: "Incompetent",
		points: 10,
		effects: [
			"All character skills are leveled 25% slower (Excluding Bolt-action Rifles)",
			"All character skills can only be increased up to level 30 (Excluding Crafting)",
		],
	},
	{ id: "polydipsia", name: "Polydipsia", points: 2, effects: ["Hydration is consumed 15% faster"] },
	{
		id: "chronic-fatigue-syndrome",
		name: "Chronic Fatigue Syndrome",
		points: 2,
		effects: ["Energy is consumed 20% faster"],
	},
	{
		id: "personality-vacuum",
		name: "Personality Vacuum",
		points: 2,
		effects: ["Charisma skill cannot be increased", "All trader items cost 20% more"],
	},
	{
		id: "dr-jekyll",
		name: "Dr. Jekyll",
		points: 1,
		effects: ["After gaining the Fresh Wound status, it cannot be removed until the end of the raid"],
	},
	{
		id: "allergic",
		name: "Allergic",
		points: 3,
		effects: ["Become allergic to 3 random items from the Provisions or Medication category"],
	},
	{
		id: "broken-secure-container",
		name: "Broken Secure Container",
		points: 6,
		effects: [
			"Secure container can only be filled with cash, keys, dogtags, special equipment, certain containers and Battle Pass documents",
		],
	},
	{
		id: "no-flea-market",
		name: "No Flea Market",
		points: 10,
		effects: ["Trading with players on the Flea Market is disabled"],
	},
	{
		id: "third-leg",
		name: "Third Leg",
		points: 1,
		effects: ["Movement speed is decreased by 1%", "Buying items at Therapist is 5% cheaper"],
	},
	{ id: "unlucky", name: "Unlucky", points: 1, effects: ["Your bad luck can sometimes have dire consequences"] },
	{
		id: "exhaustion",
		name: "Exhaustion",
		points: 5,
		effects: ["Arm and leg stamina recovers 20% slower", "Arm and leg stamina is reduced by 10"],
	},
];

export const SEASON_1_MODIFIERS: SeasonModifierSet = {
	seasonId: "season-1",
	source: { label: "Tarkov Market (season preview transcription)", url: "https://tarkov-market.com/season-1/perks" },
	note: "Values come from the season preview and may differ from the live game.",
	pickRateSource: "https://x.com/tarkov/status/2110007664503558212",
	modifiers: (
		[
			{ id: "no-insurance", name: "No Insurance", kind: "global", effects: ["Cannot insure items before raid"] },
			{
				id: "black-division",
				name: "Black Division",
				kind: "global",
				effects: ["Black Division operatives can be encountered on specific locations"],
			},
			{
				id: "no-fir-for-hideout",
				name: "No FiR for Hideout",
				kind: "global",
				effects: ["Hideout zones don't require the Found in Raid status"],
			},
			{
				id: "armor-shortage",
				name: "Armor Shortage",
				kind: "global",
				effects: ["Traders across Tarkov are experiencing an armor shortage"],
			},
			{
				id: "handyman",
				name: "Handyman",
				kind: "global",
				effects: ["Item crafting time is reduced by 50%", "Crafting skill starts at level 51"],
			},
			{
				id: "seasoned-pmcs",
				name: "Seasoned PMCs",
				kind: "global",
				effects: ["Your character gains 25% more experience"],
			},
			...personal("positive", POSITIVE, sharedIcon),
			...personal("negative", NEGATIVE, sharedIcon),
		] satisfies SeasonModifier[]
	).map((modifier) => ({
		...modifier,
		...(modifier.kind === "global" && { icon: globalIcon(modifier.id) }),
		...(PICK_RATES[modifier.id] !== undefined && { pickRate: PICK_RATES[modifier.id] }),
	})),
};
