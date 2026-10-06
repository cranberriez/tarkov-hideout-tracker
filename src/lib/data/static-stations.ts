import type { Station, StationLevel } from "@/types/hideout";

export type SetupStation = Pick<Station, "id" | "name" | "normalizedName"> & {
	levels: Array<Pick<StationLevel, "level">>;
};

/** Bundled portrait, e.g. "Hall of Fame" → /images/hideout/Hall_of_Fame_Portrait.webp. */
export const stationPortraitSrc = (name: string) => `/images/hideout/${name.replace(/ /g, "_")}_Portrait.webp`;

/** Stable Tarkov station IDs keyed by normalized name. Reference these instead of inlining IDs. */
export const STATION_IDS = {
	heating: "5d388e97081959000a123acf",
	generator: "5d3b396e33c48f02b81cd9f3",
	vents: "5d473c1e081959000e530190",
	security: "5d484fb3654e7600681d9314",
	lavatory: "5d484fba654e7600691aadf7",
	stash: "5d484fc0654e76006657e0ab",
	"water-collector": "5d484fc8654e760065037abf",
	medstation: "5d484fcd654e7668ec2ec322",
	"nutrition-unit": "5d484fd1654e76006732bf2e",
	"rest-space": "5d484fd6654e76051d3cc791",
	workbench: "5d484fda654e7600681d9315",
	"intelligence-center": "5d484fdf654e7600691aadf8",
	"shooting-range": "5d484fe3654e76006657e0ac",
	library: "5d494a0e5b56502f18c98a02",
	"scav-case": "5d494a175b56502f18c98a04",
	illumination: "5d494a205b56502f18c98a06",
	"hall-of-fame": "5d494a295b56502f18c98a08",
	"air-filtering-unit": "5d494a315b56502f18c98a0a",
	"solar-power": "5d494a385b56502f18c98a0c",
	"booze-generator": "5d494a3f5b56502f18c98a0e",
	"bitcoin-farm": "5d494a445b56502f18c98a10",
	gym: "6377a9b9a93bde8fa30eb79a",
	"defective-wall": "637b39f02e873739ec490215",
	"weapon-rack": "63db64cbf9963741dc0d741f",
	"gear-rack": "65e5bb1713227bb7690cea0a",
	"cultist-circle": "667298e75ea6b4493c08f266",
} as const;

export type StationSlug = keyof typeof STATION_IDS;

// Static list of stations with their max levels for initial setup
// This avoids needing to fetch full station data during the setup phase
export const STATIC_STATIONS: SetupStation[] = [
	{
		id: STATION_IDS.heating,
		name: "Heating",
		normalizedName: "heating",
		levels: [{ level: 1 }, { level: 2 }, { level: 3 }],
	},
	{
		id: STATION_IDS.generator,
		name: "Generator",
		normalizedName: "generator",
		levels: [{ level: 1 }, { level: 2 }, { level: 3 }],
	},
	{
		id: STATION_IDS.vents,
		name: "Vents",
		normalizedName: "vents",
		levels: [{ level: 1 }, { level: 2 }, { level: 3 }],
	},
	{
		id: STATION_IDS.security,
		name: "Security",
		normalizedName: "security",
		levels: [{ level: 1 }, { level: 2 }, { level: 3 }],
	},
	{
		id: STATION_IDS.lavatory,
		name: "Lavatory",
		normalizedName: "lavatory",
		levels: [{ level: 1 }, { level: 2 }, { level: 3 }],
	},
	{
		id: STATION_IDS.stash,
		name: "Stash",
		normalizedName: "stash",
		levels: [{ level: 1 }, { level: 2 }, { level: 3 }, { level: 4 }],
	},
	{
		id: STATION_IDS["water-collector"],
		name: "Water Collector",
		normalizedName: "water-collector",
		levels: [{ level: 1 }, { level: 2 }, { level: 3 }],
	},
	{
		id: STATION_IDS.medstation,
		name: "Medstation",
		normalizedName: "medstation",
		levels: [{ level: 1 }, { level: 2 }, { level: 3 }],
	},
	{
		id: STATION_IDS["nutrition-unit"],
		name: "Nutrition Unit",
		normalizedName: "nutrition-unit",
		levels: [{ level: 1 }, { level: 2 }, { level: 3 }],
	},
	{
		id: STATION_IDS["rest-space"],
		name: "Rest Space",
		normalizedName: "rest-space",
		levels: [{ level: 1 }, { level: 2 }, { level: 3 }],
	},
	{
		id: STATION_IDS.workbench,
		name: "Workbench",
		normalizedName: "workbench",
		levels: [{ level: 1 }, { level: 2 }, { level: 3 }],
	},
	{
		id: STATION_IDS["intelligence-center"],
		name: "Intelligence Center",
		normalizedName: "intelligence-center",
		levels: [{ level: 1 }, { level: 2 }, { level: 3 }],
	},
	{
		id: STATION_IDS["shooting-range"],
		name: "Shooting Range",
		normalizedName: "shooting-range",
		levels: [{ level: 1 }, { level: 2 }, { level: 3 }],
	},
	{
		id: STATION_IDS.library,
		name: "Library",
		normalizedName: "library",
		levels: [{ level: 1 }],
	},
	{
		id: STATION_IDS["scav-case"],
		name: "Scav Case",
		normalizedName: "scav-case",
		levels: [{ level: 1 }],
	},
	{
		id: STATION_IDS.illumination,
		name: "Illumination",
		normalizedName: "illumination",
		levels: [{ level: 1 }, { level: 2 }, { level: 3 }],
	},
	{
		id: STATION_IDS["hall-of-fame"],
		name: "Hall of Fame",
		normalizedName: "hall-of-fame",
		levels: [{ level: 1 }, { level: 2 }, { level: 3 }],
	},
	{
		id: STATION_IDS["air-filtering-unit"],
		name: "Air Filtering Unit",
		normalizedName: "air-filtering-unit",
		levels: [{ level: 1 }],
	},
	{
		id: STATION_IDS["solar-power"],
		name: "Solar Power",
		normalizedName: "solar-power",
		levels: [{ level: 1 }],
	},
	{
		id: STATION_IDS["booze-generator"],
		name: "Booze Generator",
		normalizedName: "booze-generator",
		levels: [{ level: 1 }],
	},
	{
		id: STATION_IDS["bitcoin-farm"],
		name: "Bitcoin Farm",
		normalizedName: "bitcoin-farm",
		levels: [{ level: 1 }, { level: 2 }, { level: 3 }],
	},
	{
		id: STATION_IDS.gym,
		name: "Gym",
		normalizedName: "gym",
		levels: [{ level: 1 }],
	},
	{
		id: STATION_IDS["defective-wall"],
		name: "Defective Wall",
		normalizedName: "defective-wall",
		levels: [{ level: 1 }, { level: 2 }, { level: 3 }, { level: 4 }, { level: 5 }, { level: 6 }],
	},
	{
		id: STATION_IDS["weapon-rack"],
		name: "Weapon Rack",
		normalizedName: "weapon-rack",
		levels: [{ level: 1 }, { level: 2 }, { level: 3 }],
	},
	{
		id: STATION_IDS["gear-rack"],
		name: "Gear Rack",
		normalizedName: "gear-rack",
		levels: [{ level: 1 }, { level: 2 }, { level: 3 }],
	},
	{
		id: STATION_IDS["cultist-circle"],
		name: "Cultist Circle",
		normalizedName: "cultist-circle",
		levels: [{ level: 1 }],
	},
];
