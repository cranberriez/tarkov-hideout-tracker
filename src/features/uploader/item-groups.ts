import { isBarterCategory } from "@/lib/data/barter-categories";
import type { ItemSummary } from "@/types/items";

/** Broad item groups for narrowing uploader searches, in picker order. */
export const ITEM_GROUPS = [
	{ key: "weapons", label: "Weapons" },
	{ key: "mods", label: "Weapon mods" },
	{ key: "magazines", label: "Magazines" },
	{ key: "ammo", label: "Ammo" },
	{ key: "gear", label: "Gear" },
	{ key: "containers", label: "Containers" },
	{ key: "meds", label: "Meds" },
	{ key: "provisions", label: "Provisions" },
	{ key: "keys", label: "Keys" },
	{ key: "barter", label: "Barter" },
	{ key: "info", label: "Info" },
	{ key: "other", label: "Other" },
] as const;

export type ItemGroupKey = (typeof ITEM_GROUPS)[number]["key"];

/**
 * Leaf categories from Tarkov's category tree. Catalog items keep only their leaf, so parents are
 * listed per leaf; barter leaves come from `isBarterCategory` and unlisted leaves fall into Other.
 */
const GROUP_BY_CATEGORY: Record<string, ItemGroupKey> = {
	// Weapon
	"5447b5fc4bdc2d87278b4567": "weapons", // Assault carbine
	"5447b5f14bdc2d61278b4567": "weapons", // Assault rifle
	"5447bedf4bdc2d87278b4568": "weapons", // Grenade launcher
	"5447b5cf4bdc2d65278b4567": "weapons", // Handgun
	"5447bed64bdc2d97278b4568": "weapons", // Machinegun
	"5447b6194bdc2d67278b4567": "weapons", // Marksman rifle
	"617f1ef5e8b54b0998387733": "weapons", // Revolver
	"67446d4f04141c10630604e7": "weapons", // Rocket launcher
	"5447b6094bdc2dc3278b4567": "weapons", // Shotgun
	"5447b5e04bdc2d62278b4567": "weapons", // SMG
	"5447b6254bdc2dc3278b4568": "weapons", // Sniper rifle
	"5447e1d04bdc2dff2f8b4567": "weapons", // Knife
	"543be6564bdc2df4348b4568": "weapons", // Throwable weapon
	"69f071ae35c3b5e6dd00df07": "weapons", // Volumetric throw weapon
	// Weapon mod
	"555ef6e44bdc2de9068b457e": "mods", // Barrel
	"55818a104bdc2db9688b4569": "mods", // Handguard
	"55818a684bdc2ddd698b456d": "mods", // Pistol grip
	"55818a304bdc2db5418b457d": "mods", // Receiver
	"5a74651486f7744e73386dd1": "mods", // Auxiliary mod
	"55818afb4bdc2dde698b456d": "mods", // Bipod
	"55818b164bdc2ddc698b456c": "mods", // Combined tactical device
	"55818b084bdc2d5b648b4571": "mods", // Flashlight
	"55818af64bdc2d5b648b4570": "mods", // Foregrip
	"56ea9461d2720b67698b456f": "mods", // Gas block
	"550aa4dd4bdc2dc9348b4569": "mods", // Combined muzzle device
	"550aa4bf4bdc2dd6348b456b": "mods", // Flashhider
	"550aa4cd4bdc2dd8348b456c": "mods", // Silencer
	"55818add4bdc2d5b648b456f": "mods", // Assault scope
	"55818acf4bdc2dde698b456b": "mods", // Compact reflex sight
	"55818ac54bdc2d5b648b456e": "mods", // Ironsight
	"55818ad54bdc2ddc698b4569": "mods", // Reflex sight
	"55818ae44bdc2dde698b456c": "mods", // Scope
	"55818aeb4bdc2ddc698b456a": "mods", // Special scope
	"55818a6f4bdc2db9688b456b": "mods", // Charging handle
	"55818b224bdc2dde698b456f": "mods", // Mount
	"55818a594bdc2db9688b456a": "mods", // Stock
	"55818b014bdc2ddc698b456b": "mods", // UBGL
	"5448bc234bdc2d3c308b4569": "magazines", // Magazine
	"610720f290b75a49ff2e5e25": "magazines", // Cylinder magazine
	"627a137bf21bc425b06ab944": "magazines", // Spring driven cylinder
	// Stackable
	"5485a8684bdc2da71d8b4567": "ammo", // Ammo
	"677ae5df4be46b83620bf055": "ammo", // Rocket
	"543be5cb4bdc2deb348b4568": "ammo", // Ammo container
	// Equipment; head-worn night and thermal vision sit under Special scope in the tree.
	"5a2c3a9486f774688b05e574": "gear", // Night vision
	"5d21f59b6dbe99052b54ef83": "gear", // Thermal vision
	"5b3f15d486f77432d0509248": "gear", // Arm band
	"57bef4c42459772e8d35a53b": "gear", // Armored equipment
	"5448e54d4bdc2dcc718b4568": "gear", // Armor
	"644120aa86ffbe10ee032b6f": "gear", // Armor plate
	"5a341c4686f77469e155819e": "gear", // Face cover
	"5a341c4086f77401f2541505": "gear", // Headwear
	"5448e5724bdc2ddf718b4568": "gear", // Visual observation device
	"5645bcb74bdc2ded0b8b4578": "gear", // Headphones
	"5448e53e4bdc2d60728b4567": "gear", // Backpack
	"5448e5284bdc2dcb718b4567": "gear", // Chest rig
	// Containers
	"5795f317245977243854e041": "containers", // Common container
	"5671435f4bdc2d96058b4569": "containers", // Locking container
	"5448bf274bdc2dfc2f8b456a": "containers", // Portable container
	"62f109593b54472778797866": "containers", // Random loot container
	// Meds
	"5448f3a14bdc2d27728b4569": "meds", // Drug
	"5448f3ac4bdc2dce718b4569": "meds", // Medical item
	"5448f39d4bdc2d0a728b4568": "meds", // Medikit
	"5448f3a64bdc2d60728b456a": "meds", // Stimulant
	// Food and drink
	"5448e8d64bdc2dce718b4568": "provisions", // Drink
	"5448e8d04bdc2ddf718b4569": "provisions", // Food
	// Key
	"5c164d2286f774194c5e69fa": "keys", // Keycard
	"5c99f98d86f7745c314214b3": "keys", // Mechanical key
	// Info and completables
	"5448ecbe4bdc2d60728b4568": "info", // Info
	"684070bd2f743ae53b0b80ec": "info", // Dialog item
	"67a27459e3515dec4105927b": "info", // Notes
	"6516b0f21e733a595c1016fb": "info", // Tapes
	"567849dd4bdc2d150f8b456e": "info", // Map
};

export function itemGroup(item: ItemSummary): ItemGroupKey {
	const category = item.categoryId;
	if (isBarterCategory(category)) return "barter";
	return (category && GROUP_BY_CATEGORY[category]) || "other";
}

export function itemGroupLabel(key: ItemGroupKey) {
	return ITEM_GROUPS.find((group) => group.key === key)?.label ?? key;
}
