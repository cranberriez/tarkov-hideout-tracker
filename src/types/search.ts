import type { TarkovJsonGameMode } from "../lib/game-mode";

/** Stored content excludes revision identity so unchanged updates remain no-ops. */
export interface CompactSearchManifest {
	v: 1;
	mode: TarkovJsonGameMode;
	/** `b`: barter-item (junk box) category. `c`: index into `categories`. `q`: quest-only item (see `isQuestOnlyItem`). */
	items: { id: string; nn: string; n: string; sn?: string; ic?: string; b?: 1; c?: number; q?: 1 }[];
	/** Leaf item category IDs referenced by item `c`. */
	categories: string[];
	quests: { id: string; nn: string; n: string; ti: string }[];
	traders: Record<string, { n: string; ic?: string }>;
}
export interface SearchManifestPayload extends CompactSearchManifest {
	releaseId: string;
}
