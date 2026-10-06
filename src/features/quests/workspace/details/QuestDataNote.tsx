import { Info } from "lucide-react";
import type { FullQuest } from "@/types/quests";

/** Reminder that quest data can lag the game. Kept last in the details pane so it takes no space above the content. */
export function QuestDataNote({ quest }: { quest: FullQuest }) {
	return (
		<div className="mt-12 flex items-start gap-2.5 rounded-md border border-warning/25 bg-warning/[0.06] px-3.5 py-3 text-sm leading-relaxed text-warning/85">
			<Info size={16} className="mt-[3px] shrink-0" />
			{quest.customSource ? (
				<p>
					This quest was entered by hand from the{" "}
					<a
						href={quest.customSource}
						target="_blank"
						rel="noreferrer"
						className="font-medium underline decoration-warning/40 underline-offset-2 hover:text-warning"
					>
						wiki
					</a>{" "}
					after the latest game update, so its details may be inaccurate.
				</p>
			) : (
				<p>Quest data can lag behind the latest game update, so details may be inaccurate.</p>
			)}
		</div>
	);
}
