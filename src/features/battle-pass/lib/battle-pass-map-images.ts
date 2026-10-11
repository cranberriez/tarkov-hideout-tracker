import imagePaths from "../../../lib/data/battle-pass-map-images.json";

/** Keep source URLs intact for calibration checks; render only bundled assets. */
export function localDocumentMapImage(source: string, paths: Record<string, string> = imagePaths): string {
	return paths[source] ?? "/images/battle-pass/map-assets/unavailable";
}
