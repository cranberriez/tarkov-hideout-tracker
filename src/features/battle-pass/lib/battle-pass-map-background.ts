import registrations from "../../../lib/data/battle-pass-map-backgrounds.json";
import type { BattlePassDocumentMap } from "../../../lib/battle-pass-map-data";

type Point = { x: number; y: number };

export type DocumentBasemapRegistration = {
	mapId: string;
	imageUrl: string;
	width: number;
	height: number;
	sourceWidth: number;
	sourceHeight: number;
	/** SVG affine ordering: x′ = ax + cy + e; y′ = bx + dy + f. */
	transform: number[];
	sourceUrl: string;
	author: string;
	authorUrl: string | null;
	license: string;
	verification: {
		note: string;
		maxError: number;
		landmarks: { source: Point; target: Point; correlation?: number }[];
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
) {
	const { transform, verification } = registration;
	if (
		registration.mapId !== map.id ||
		registration.sourceWidth !== map.width ||
		registration.sourceHeight !== map.height ||
		![registration.width, registration.height].every((value) => Number.isFinite(value) && value > 0) ||
		transform.length !== 6 ||
		!transform.every(Number.isFinite) ||
		Math.abs(transform[0] * transform[3] - transform[1] * transform[2]) < 1e-8 ||
		!verification ||
		!Number.isFinite(verification.maxError) ||
		verification.maxError < 0 ||
		verification.landmarks.length < 3
	)
		return false;
	return verification.landmarks.every(({ source, target }) => {
		if (![source.x, source.y, target.x, target.y].every(Number.isFinite)) return false;
		const projected = projectDocumentPoint(source, transform);
		return Math.hypot(projected.x - target.x, projected.y - target.y) <= verification.maxError;
	});
}

export function resolveDocumentBasemap(map: BattlePassDocumentMap, useOriginal = false) {
	const registration = (registrations.maps as DocumentBasemapRegistration[]).find((entry) => entry.mapId === map.id);
	const replacement =
		!useOriginal && registration && isDocumentBasemapRegistrationValid(map, registration) ? registration : undefined;
	return {
		imageUrl: replacement?.imageUrl ?? map.imageUrl,
		width: replacement?.width ?? map.width,
		height: replacement?.height ?? map.height,
		sourceUrl: replacement?.sourceUrl ?? map.sourceUrl,
		attribution: replacement ? `Map: ${replacement.author} · tarkov.dev · Game assets © BSG` : map.attribution,
		license: replacement?.license ?? map.license,
		usesReplacement: Boolean(replacement),
		project: (point: Point): Point =>
			replacement ? projectDocumentPoint(point, replacement.transform) : { x: point.x, y: point.y },
		// Original data can deliberately use a scaled native canvas (Interchange).
		matchesDimensions: (width: number, height: number) =>
			!replacement || (width === replacement.width && height === replacement.height),
	};
}
