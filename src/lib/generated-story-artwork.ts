import manifest from "./generated-story-artwork.json";

const artwork: Record<string, string> = manifest;

export function generatedStoryArtwork(src: string): string | undefined {
	const match = /^\/images\/story\/([^/]+)\/steps\/([^/]+)$/.exec(src);
	const hash = match && artwork[`${match[1]}/${match[2]}`];
	return hash ? `/images/generated-artwork/${hash}.webp` : undefined;
}
