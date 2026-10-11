import { documentItemIds } from "./battle-pass-inventory";

interface DocumentLocationArtwork {
	id: string;
	name: string;
	image512pxLink: string;
}

// Verified 2026-10-09 against the same seasonal provider dataset used by the item adapter:
// https://json.tarkov.dev/pvp-season/items and https://json.tarkov.dev/pvp-season/items_en.
// All eight returned image512pxLink assets have alpha in their WebP headers.
// Keep this presentation-only experiment local to Locations. Missing entries use doc.img.
export const documentLocationArtwork: Readonly<Record<string, DocumentLocationArtwork>> = {
	financial: {
		id: documentItemIds.financial,
		name: "Financial documents",
		image512pxLink: "https://assets.tarkov.dev/6a31807f17005505b70d5827-512.webp",
	},
	personnel: {
		id: documentItemIds.personnel,
		name: "PMC personnel files",
		image512pxLink: "https://assets.tarkov.dev/6a317b9692cfdcddcb02a58e-512.webp",
	},
	project: {
		id: documentItemIds.project,
		name: "Project documentation",
		image512pxLink: "https://assets.tarkov.dev/6a3181f178450ec91c0ea1aa-512.webp",
	},
	blueprints: {
		id: documentItemIds.blueprints,
		name: "Blueprints and technical documentation",
		image512pxLink: "https://assets.tarkov.dev/6a31824878450ec91c0ea1ae-512.webp",
	},
	test: {
		id: documentItemIds.test,
		name: "Test documentation",
		image512pxLink: "https://assets.tarkov.dev/6a31828557705071410ca00e-512.webp",
	},
	user: {
		id: documentItemIds.user,
		name: "User documentation",
		image512pxLink: "https://assets.tarkov.dev/6a3182b72fd891345e047eef-512.webp",
	},
	medical: {
		id: documentItemIds.medical,
		name: "Medical documents",
		image512pxLink: "https://assets.tarkov.dev/6a3182dc6cd8de21cf0a3a7d-512.webp",
	},
	technical: {
		id: documentItemIds.technical,
		name: "Technical documentation",
		image512pxLink: "https://assets.tarkov.dev/6a31830dde69ceafd805afa0-512.webp",
	},
};
