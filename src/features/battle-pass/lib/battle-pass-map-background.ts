import registrations from "../../../lib/data/battle-pass-map-backgrounds.json";
import {
	documentLocations,
	type BattlePassDocumentLocation,
	type BattlePassDocumentMap,
} from "../../../lib/battle-pass-map-data";

type Point = { x: number; y: number };

export type ManualDocumentPosition = {
	id: string;
	source: Point & { floor: string | null; layer: string };
	target: Point;
	note: string;
};

export type DocumentBasemapRegistration = {
	mapId: string;
	imageUrl: string;
	width: number;
	height: number;
	sourceWidth: number;
	sourceHeight: number;
	/** SVG affine ordering: x′ = ax + cy + e; y′ = bx + dy + f. */
	transform?: number[];
	/** Rearranged floor artwork requires an individually checked position for every source record. */
	manualPositions?: ManualDocumentPosition[];
	sourceImageUrl?: string;
	sourceUrl: string;
	author: string;
	authorUrl: string | null;
	license: string;
	verification: {
		note: string;
		maxError?: number;
		landmarks: { source: Point; target: Point; correlation?: number; label?: string }[];
	};
};

export function projectDocumentPoint(point: Point, transform: readonly number[]): Point {
	const [a, b, c, d, e, f] = transform;
	return { x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f };
}

/** Reject stale source canvases and incomplete/singular registrations. */
export function isDocumentBasemapRegistrationValid(
	map: BattlePassDocumentMap,
	registration: DocumentBasemapRegistration,
	locations: readonly BattlePassDocumentLocation[] = documentLocations,
) {
	const { transform, manualPositions, verification } = registration;
	if (
		registration.mapId !== map.id ||
		registration.sourceWidth !== map.width ||
		registration.sourceHeight !== map.height ||
		![registration.width, registration.height].every((value) => Number.isFinite(value) && value > 0) ||
		!verification ||
		!verification.note.trim() ||
		verification.landmarks.length < 3
	)
		return false;
	if (manualPositions) {
		if (transform || registration.sourceImageUrl !== map.imageUrl) return false;
		const sourceLocations = locations.filter((location) => location.mapId === map.id);
		if (!sourceLocations.length || manualPositions.length !== sourceLocations.length) return false;
		const byId = new Map(manualPositions.map((position) => [position.id, position]));
		if (byId.size !== manualPositions.length) return false;
		return (
			sourceLocations.every((location) => {
				const position = byId.get(location.id);
				return Boolean(
					position &&
					position.note.trim() &&
					position.source.x === location.x &&
					position.source.y === location.y &&
					position.source.floor === location.floor &&
					position.source.layer === location.layer &&
					isWithinCanvas(position.target, registration.width, registration.height),
				);
			}) &&
			verification.landmarks.every(
				({ source, target, label }) =>
					Boolean(label?.trim()) &&
					isWithinCanvas(source, map.width, map.height) &&
					isWithinCanvas(target, registration.width, registration.height),
			)
		);
	}
	if (
		!transform ||
		transform.length !== 6 ||
		!transform.every(Number.isFinite) ||
		Math.abs(transform[0] * transform[3] - transform[1] * transform[2]) < 1e-8 ||
		verification.maxError === undefined ||
		!Number.isFinite(verification.maxError) ||
		verification.maxError < 0
	)
		return false;
	return verification.landmarks.every(({ source, target }) => {
		if (![source.x, source.y, target.x, target.y].every(Number.isFinite)) return false;
		const projected = projectDocumentPoint(source, transform);
		return Math.hypot(projected.x - target.x, projected.y - target.y) <= verification.maxError!;
	});
}

function isWithinCanvas(point: Point, width: number, height: number) {
	return (
		Number.isFinite(point.x) &&
		Number.isFinite(point.y) &&
		point.x >= 0 &&
		point.x <= width &&
		point.y >= 0 &&
		point.y <= height
	);
}

export function resolveDocumentBasemap(
	map: BattlePassDocumentMap,
	useOriginal = false,
	sourceRegistrations = registrations,
	locations = documentLocations,
) {
	const registration = (sourceRegistrations.maps as DocumentBasemapRegistration[]).find(
		(entry) => entry.mapId === map.id,
	);
	const replacement =
		!useOriginal && registration && isDocumentBasemapRegistrationValid(map, registration, locations)
			? registration
			: undefined;
	const manualPositions = new Map(replacement?.manualPositions?.map((position) => [position.id, position.target]));
	return {
		imageUrl: replacement?.imageUrl ?? map.imageUrl,
		width: replacement?.width ?? map.width,
		height: replacement?.height ?? map.height,
		sourceUrl: replacement?.sourceUrl ?? map.sourceUrl,
		attribution: replacement ? `Map: ${replacement.author} · tarkov.dev · Game assets © BSG` : map.attribution,
		license: replacement?.license ?? map.license,
		usesReplacement: Boolean(replacement),
		project: (point: Point & { id?: string }): Point => {
			const manual = point.id ? manualPositions.get(point.id) : undefined;
			if (manual) return { ...manual };
			if (replacement?.manualPositions) throw new Error(`Missing calibrated document position: ${point.id ?? "no ID"}`);
			return replacement?.transform ? projectDocumentPoint(point, replacement.transform) : { x: point.x, y: point.y };
		},
		// Original data can deliberately use a scaled native canvas (Interchange).
		matchesDimensions: (width: number, height: number) =>
			!replacement || (width === replacement.width && height === replacement.height),
	};
}
