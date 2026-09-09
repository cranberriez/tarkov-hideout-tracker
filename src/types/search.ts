import type { TarkovJsonGameMode } from "../lib/game-mode";

/** Stored content excludes revision identity so unchanged updates remain no-ops. */
export interface CompactSearchManifest {
	v: 1;
	mode: TarkovJsonGameMode;
	items: { id: string; nn: string; n: string; sn?: string; ic?: string }[];
	quests: { id: string; nn: string; n: string; ti: string }[];
	traders: Record<string, { n: string; ic?: string }>;
}
export interface SearchManifestPayload extends CompactSearchManifest {
	releaseId: string;
}
