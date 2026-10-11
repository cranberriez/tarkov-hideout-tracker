import locations from "@/lib/data/season-1-document-locations.json";
export { default as locations } from "@/lib/data/season-1-document-locations.json";
export const mapNames: Record<string, string[]> = locations.mapsByDocumentKey;

/** Compact type labels for presentation; source names and document keys stay canonical. */
export function documentDisplayName(name: string): string {
	if (name === "Blueprints and technical documentation") return "BP and Tech Docs";
	if (name === "PMC personnel files") return "PMC personnel";
	return name.replace(/\b(?:documents|documentation)\b/gi, "Docs");
}

export const mapOrder = [
	"Factory",
	"Customs",
	"Ground Zero",
	"Interchange",
	"Streets of Tarkov",
	"Reserve",
	"Lighthouse",
	"Shoreline",
	"Woods",
	"The Lab",
	"The Labyrinth",
	"Icebreaker",
];

export const documentMarks: Record<string, { color: string; shape: string }> = {
	financial: { color: "#4ade80", shape: "circle" },
	personnel: { color: "#a78bfa", shape: "triangle" },
	project: { color: "#22d3ee", shape: "square" },
	blueprints: { color: "#60a5fa", shape: "diamond" },
	test: { color: "#f87171", shape: "octagon" },
	user: { color: "#facc15", shape: "pentagon" },
	medical: { color: "#fb7185", shape: "cross" },
	technical: { color: "#2dd4bf", shape: "hexagon" },
	classified: { color: "#fb923c", shape: "star" },
};

/** Tiles that take an extra grid slot so every page fills a 2x3 grid. */
export const tileSpans: Record<string, "wide" | "tall"> = {
	"season-1-page-1-slot-5": "wide",
	"season-1-page-2-slot-2": "tall",
	"season-1-page-3-slot-3": "wide",
	"season-1-page-4-slot-2": "tall",
	"season-1-page-5-slot-1": "tall",
	"season-1-page-6-slot-1": "tall",
	"season-1-page-6-slot-2": "tall",
	"season-1-page-6-slot-3": "wide",
	"season-1-page-7-slot-3": "tall",
	"season-1-page-7-slot-4": "tall",
	"season-1-page-8-slot-3": "wide",
	"season-1-page-9-slot-5": "wide",
	"season-1-page-10-slot-1": "wide",
	"season-1-page-10-slot-2": "wide",
	"season-1-page-11-slot-3": "tall",
	"season-1-page-11-slot-4": "tall",
	"season-1-page-12-slot-1": "wide",
	"season-1-page-12-slot-2": "tall",
	"season-1-page-12-slot-3": "tall",
};
