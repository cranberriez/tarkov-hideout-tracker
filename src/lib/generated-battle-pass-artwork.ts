import manifest from "./generated-battle-pass-artwork.json";

const artwork: Record<string, string[]> = manifest;

export function generatedBattlePassArtwork(src: string): string[] | undefined {
	const prefix = "/images/battle-pass/";
	if (!src.startsWith(prefix)) return undefined;
	return artwork[src.slice(prefix.length)]?.map((hash) => `/images/generated-artwork/${hash}.webp`);
}
