import styles from "./ProfitTable.module.css";
import { LockReasons } from "./LockReasons";
import Image from "next/image";
import { LockKeyhole } from "lucide-react";
import type { RecipeEvaluation } from "@/lib/price-calculation";
import type { ProfitStationSource } from "../types";
import type { Trader } from "@/types/traders";

export function ProfitSourceCell({
	evaluation,
	source,
	available,
}: {
	evaluation: RecipeEvaluation;
	source?: Trader | ProfitStationSource;
	available: boolean;
}) {
	return (
		<span className={styles.sourceCell}>
			<span className={`relative flex size-9 shrink-0 items-center justify-center ${styles.sourceIcon}`}>
				{source?.imageLink && <Image src={source.imageLink} alt="" width={36} height={36} className="size-9 rounded object-contain" unoptimized />}
				{!available && (
					<span
						title="Locked for the current profile"
						className={`${styles.sourceLock} absolute -right-5 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center rounded-[3px] bg-amber-400 text-black shadow-md`}
					>
						<LockKeyhole className="size-2.5 stroke-[3]" />
					</span>
				)}
			</span>
			<span className={styles.sourceDetails}>
				<span className="flex max-w-full items-center justify-center gap-1 text-[11px] font-medium text-foreground">
					<span className="truncate">{source?.name ?? "Unknown"}</span>
					{evaluation.barter && (
						<span className="shrink-0 font-mono text-[10px] text-muted-foreground">
							LL
							<strong className="text-foreground">{evaluation.barter.minTraderLevel}</strong>
						</span>
					)}
					{evaluation.craft && <strong className="shrink-0 font-mono text-[10px] text-foreground">{evaluation.craft.level}</strong>}
				</span>
				<LockReasons reasons={evaluation.lockReasons ?? []} showIcon={false} />
			</span>
		</span>
	);
}
