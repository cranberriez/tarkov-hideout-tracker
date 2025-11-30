import type { Station } from "@/types";

// Static list of stations with their max levels for initial setup
// This avoids needing to fetch full station data during the setup phase
export const STATIC_STATIONS: Station[] = [
    {
        id: "5d388e97081959000a123acf",
        name: "Heating",
        normalizedName: "heating",
        levels: [{ level: 1 }, { level: 2 }, { level: 3 }] as any[],
    },
    {
        id: "5d3b396e33c48f02b81cd9f3",
        name: "Generator",
        normalizedName: "generator",
        levels: [{ level: 1 }, { level: 2 }, { level: 3 }] as any[],
    },
    {
        id: "5d473c1e081959000e530190",
        name: "Vents",
        normalizedName: "vents",
        levels: [{ level: 1 }, { level: 2 }, { level: 3 }] as any[],
    },
    {
        id: "5d484fb3654e7600681d9314",
        name: "Security",
        normalizedName: "security",
        levels: [{ level: 1 }, { level: 2 }, { level: 3 }] as any[],
    },
    {
        id: "5d484fba654e7600691aadf7",
        name: "Lavatory",
        normalizedName: "lavatory",
        levels: [{ level: 1 }, { level: 2 }, { level: 3 }] as any[],
    },
    {
        id: "5d484fc0654e76006657e0ab",
        name: "Stash",
        normalizedName: "stash",
        levels: [{ level: 1 }, { level: 2 }, { level: 3 }, { level: 4 }] as any[],
    },
    {
        id: "5d484fc8654e760065037abf",
        name: "Water Collector",
        normalizedName: "water-collector",
        levels: [{ level: 1 }, { level: 2 }, { level: 3 }] as any[],
    },
    {
        id: "5d484fcd654e7668ec2ec322",
        name: "Medstation",
        normalizedName: "medstation",
        levels: [{ level: 1 }, { level: 2 }, { level: 3 }] as any[],
    },
    {
        id: "5d484fd1654e76006732bf2e",
        name: "Nutrition Unit",
        normalizedName: "nutrition-unit",
        levels: [{ level: 1 }, { level: 2 }, { level: 3 }] as any[],
    },
    {
        id: "5d484fd6654e76051d3cc791",
        name: "Rest Space",
        normalizedName: "rest-space",
        levels: [{ level: 1 }, { level: 2 }, { level: 3 }] as any[],
    },
    {
        id: "5d484fda654e7600681d9315",
        name: "Workbench",
        normalizedName: "workbench",
        levels: [{ level: 1 }, { level: 2 }, { level: 3 }] as any[],
    },
    {
        id: "5d484fdf654e7600691aadf8",
        name: "Intelligence Center",
        normalizedName: "intelligence-center",
        levels: [{ level: 1 }, { level: 2 }, { level: 3 }] as any[],
    },
    {
        id: "5d484fe3654e76006657e0ac",
        name: "Shooting Range",
        normalizedName: "shooting-range",
        levels: [{ level: 1 }, { level: 2 }, { level: 3 }] as any[],
    },
    {
        id: "5d494a0e5b56502f18c98a02",
        name: "Library",
        normalizedName: "library",
        levels: [{ level: 1 }] as any[],
    },
    {
        id: "5d494a175b56502f18c98a04",
        name: "Scav Case",
        normalizedName: "scav-case",
        levels: [{ level: 1 }] as any[],
    },
    {
        id: "5d494a205b56502f18c98a06",
        name: "Illumination",
        normalizedName: "illumination",
        levels: [{ level: 1 }, { level: 2 }, { level: 3 }] as any[],
    },
    {
        id: "5d494a295b56502f18c98a08",
        name: "Hall of Fame",
        normalizedName: "hall-of-fame",
        levels: [{ level: 1 }, { level: 2 }, { level: 3 }] as any[],
    },
    {
        id: "5d494a315b56502f18c98a0a",
        name: "Air Filtering Unit",
        normalizedName: "air-filtering-unit",
        levels: [{ level: 1 }] as any[],
    },
    {
        id: "5d494a385b56502f18c98a0c",
        name: "Solar Power",
        normalizedName: "solar-power",
        levels: [{ level: 1 }] as any[],
    },
    {
        id: "5d494a3f5b56502f18c98a0e",
        name: "Booze Generator",
        normalizedName: "booze-generator",
        levels: [{ level: 1 }] as any[],
    },
    {
        id: "5d494a445b56502f18c98a10",
        name: "Bitcoin Farm",
        normalizedName: "bitcoin-farm",
        levels: [{ level: 1 }, { level: 2 }, { level: 3 }] as any[],
    },
    {
        id: "6377a9b9a93bde8fa30eb79a",
        name: "Gym",
        normalizedName: "gym",
        levels: [{ level: 1 }] as any[],
    },
    {
        id: "637b39f02e873739ec490215",
        name: "Defective Wall",
        normalizedName: "defective-wall",
        levels: [
            { level: 1 },
            { level: 2 },
            { level: 3 },
            { level: 4 },
            { level: 5 },
            { level: 6 },
        ] as any[],
    },
    {
        id: "63db64cbf9963741dc0d741f",
        name: "Weapon Rack",
        normalizedName: "weapon-rack",
        levels: [{ level: 1 }, { level: 2 }, { level: 3 }] as any[],
    },
    {
        id: "65e5bb1713227bb7690cea0a",
        name: "Gear Rack",
        normalizedName: "gear-rack",
        levels: [{ level: 1 }, { level: 2 }, { level: 3 }] as any[],
    },
    {
        id: "667298e75ea6b4493c08f266",
        name: "Cultist Circle",
        normalizedName: "cultist-circle",
        levels: [{ level: 1 }] as any[],
    },
];
