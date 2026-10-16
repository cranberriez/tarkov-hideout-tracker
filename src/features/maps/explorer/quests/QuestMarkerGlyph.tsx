import type { CSSProperties } from "react";
import { QuestObjectiveIcon } from "../../../quests/objectives/QuestObjectiveIcon";

/*
 * Map-only quest colours: mid-bright so white icons stay legible, told apart by hue, and clear of the extract
 * greens, transit amber and hazard reds drawn on the same map. Unlike the theme's chart colours, they carry no
 * status meaning.
 */
const QUEST_COLORS = [
	"#4f9dff", // blue
	"#b47cff", // violet
	"#ff6fb5", // pink
	"#26c6b0", // teal
	"#ff8c42", // orange
	"#7cb342", // lime
	"#e86bf0", // magenta
	"#3bb4d8", // cyan
	"#c06c84", // dusty rose
	"#8b93ff", // periwinkle
	"#d4a373", // tan
	"#8a9a3a", // olive
];

/** Quest colour by its place in the drawer list; colours repeat only past twelve quests. */
export function questColors(questIds: readonly string[]) {
	return new Map(questIds.map((id, index) => [id, QUEST_COLORS[index % QUEST_COLORS.length]]));
}

/** A quest objective marker: the objective type's icon on a disc in the quest's colour. */
export function QuestMarkerGlyph({ type, color, className }: { type: string; color: string; className?: string }) {
	return (
		<span
			className={`quest-glyph ${className ?? ""}`}
			style={{ "--quest-color": color } as CSSProperties}
			aria-hidden="true"
		>
			<QuestObjectiveIcon type={type} size={11} className="text-white" />
		</span>
	);
}
