"use client";
import { useBattlePassData } from "../BattlePassSeason";
import { Flag, LockKeyhole, TriangleAlert } from "lucide-react";

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
	errorPages = new Set<number>(),
	unsetPages = new Set<number>(),
}: {
	first: number;
	spread: number;
	complete: Set<string>;
	goals: Set<string>;
	openPages: boolean[];
	go: (to: number) => void;
	possibleProgress: number[];
	errorPages?: Set<number>;
	unsetPages?: Set<number>;
}) {
	const { pages } = useBattlePassData();
	return (
		<nav aria-label="Battle pass pages" className={styles.minimap}>
			<div className="container mx-auto flex items-stretch gap-1 px-4 sm:px-6">
				{pages.map((page, index) => {
					const total = page.cells.length;
					const done = page.cells.filter((tile) => complete.has(tile.id)).length;
					const possible = possibleProgress[index] ?? 0;
					const goalCount = page.cells.filter((tile) => goals.has(tile.id) && !complete.has(tile.id)).length;
					const current = index >= first && index < first + spread;
					const hasErrors = errorPages.has(page.num);
					const hasUnset = unsetPages.has(page.num);
					return (
						<button
							key={page.num}
							type="button"
							onClick={() => go(index)}
							aria-label={`Page ${page.num}: ${done} of ${total} claimed${possible > 0 ? `, ${possible.toFixed(1)} additional reward equivalents possible` : ""}${goalCount ? `, ${goalCount} goals` : ""}${openPages[index] ? "" : ", locked"}${hasErrors ? ", document cost errors" : hasUnset ? ", document costs not fully set" : ""}`}
							aria-current={current ? "true" : undefined}
							className={cn(styles.mini, current && styles.miniCurrent)}
						>
							<span className="flex items-center justify-between text-[10px] tabular-nums">
								<span>{String(page.num).padStart(2, "0")}</span>
								{hasErrors ? (
									<span
										className="text-xs font-bold leading-none text-danger"
										aria-hidden
										title="Document costs need fixing"
									>
										!
									</span>
								) : hasUnset ? (
									<span title="Document costs not fully set">
										<TriangleAlert size={10} className="text-warning" aria-hidden />
									</span>
								) : !openPages[index] ? (
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
