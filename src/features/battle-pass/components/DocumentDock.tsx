import { FileText, X } from "lucide-react";
import type { coverCosts, planGoals } from "../lib/battle-pass-model";
import type { useBattlePass } from "../useBattlePass";
import { DocumentInventory } from "./DocumentInventory";
import { ConsumeDocumentsToggle } from "./ConsumeDocumentsToggle";
import styles from "../battle-pass.module.css";

export function DocumentDock({
	documentsOpen,
	setDocumentsOpen,
	progress,
	update,
	coverage,
	scope,
	plan,
	consumeDocs,
	setConsumeDocs,
}: {
	documentsOpen: boolean;
	setDocumentsOpen: (open: boolean) => void;
	progress: ReturnType<typeof useBattlePass>[0];
	update: ReturnType<typeof useBattlePass>[1];
	coverage: ReturnType<typeof coverCosts>;
	scope: "all" | "goals";
	plan: ReturnType<typeof planGoals>;
	consumeDocs: boolean;
	setConsumeDocs: (checked: boolean) => void;
}) {
	return (
		<div
			className={styles.documentDock}
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					setDocumentsOpen(false);
					event.currentTarget.querySelector("button")?.focus();
				}
			}}
		>
			<button
				type="button"
				className={styles.dockToggle}
				aria-label={documentsOpen ? "Close document panel" : "Open document panel"}
				aria-expanded={documentsOpen}
				aria-controls="floating-documents"
				onClick={() => setDocumentsOpen(!documentsOpen)}
			>
				{documentsOpen ? <X size={20} /> : <FileText size={20} />}
				{!documentsOpen && coverage.missing > 0 && <span className={styles.badge}>{coverage.missing}</span>}
			</button>
			{documentsOpen && (
				<aside id="floating-documents" aria-labelledby="floating-documents-heading" className={styles.documentPanel}>
					<h2 id="floating-documents-heading" className="pr-10 text-sm font-semibold">
						Documents
					</h2>
					<DocumentInventory progress={progress} update={update} coverage={coverage} />
					<div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
						<span>Total for {scope === "all" ? "all" : "goals"}</span>
						<span className="text-sm font-semibold tabular-nums text-foreground">{plan.total}</span>
					</div>
					<div className="mt-2">
						<ConsumeDocumentsToggle checked={consumeDocs} onChange={setConsumeDocs} />
					</div>
				</aside>
			)}
		</div>
	);
}
