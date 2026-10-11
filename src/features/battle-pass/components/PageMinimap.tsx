import { Flag, LockKeyhole } from "lucide-react";
import { pages } from "../lib/battle-pass-model";
import { cn } from "@/lib/utils";
import styles from "../battle-pass.module.css";

export function PageMinimap({
	first,
	spread,
	complete,
	goals,
	openPages,
	go,
	possibleProgress,
}: {
	first: number;
	spread: number;
	complete: Set<string>;
	goals: Set<string>;
	openPages: boolean[];
	go: (to: number) => void;
	possibleProgress: number[];
}) {
	return (
		<nav aria-label="Battle pass pages" className={styles.minimap}>
			<div className="container mx-auto flex items-stretch gap-1 px-4 sm:px-6">
				{pages.map((page, index) => {
					const total = page.cells.length;
					const done = page.cells.filter((tile) => complete.has(tile.id)).length;
					const possible = possibleProgress[index] ?? 0;
					const goalCount = page.cells.filter((tile) => goals.has(tile.id) && !complete.has(tile.id)).length;
					const current = index >= first && index < first + spread;
					return (
						<button
							key={page.num}
							type="button"
							onClick={() => go(index)}
							aria-label={`Page ${page.num}: ${done} of ${total} claimed${possible > 0 ? `, ${possible.toFixed(1)} additional reward equivalents possible` : ""}${goalCount ? `, ${goalCount} goals` : ""}${openPages[index] ? "" : ", locked"}`}
							aria-current={current ? "true" : undefined}
							className={cn(styles.mini, current && styles.miniCurrent)}
						>
							<span className="flex items-center justify-between text-[10px] tabular-nums">
								<span>{String(page.num).padStart(2, "0")}</span>
								{!openPages[index] ? (
									<LockKeyhole size={10} />
								) : goalCount > 0 ? (
									<Flag size={10} className="text-brand" fill="currentColor" />
								) : null}
							</span>
							<span className="mt-1 flex h-1 overflow-hidden rounded bg-surface-raised">
								<span className="block h-full bg-success" style={{ width: `${(done / total) * 100}%` }} />
								<span className="block h-full bg-warning" style={{ width: `${(possible / total) * 100}%` }} />
							</span>
						</button>
					);
				})}
			</div>
		</nav>
	);
}
