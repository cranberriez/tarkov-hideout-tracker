import { Check } from "lucide-react";
import { documents, type Costs } from "../lib/battle-pass-model";
import { DocumentChip } from "./ui/DocumentChip";
import { cn } from "@/lib/utils";
import styles from "../battle-pass.module.css";

export function CostList({ costs, inventory, wide = false }: { costs: Costs; inventory: Costs; wide?: boolean }) {
	const shown = documents.filter((doc) => (costs[doc.key] ?? 0) > 0);
	return (
		<div
			className={cn(
				styles.costGrid,
				"content-start",
				wide ? "grid-cols-6" : shown.length > 4 ? "grid-cols-3" : "grid-cols-4",
			)}
		>
			{shown.map((doc, i) => (
				<DocumentChip
					key={doc.key}
					doc={doc}
					amount={costs[doc.key]}
					fulfilled={(inventory[doc.key] ?? 0) >= costs[doc.key]}
					end={i >= Math.ceil(shown.length / 2)}
				/>
			))}
			{shown.length === 0 && (
				<span className="flex items-center gap-1 text-xs text-success">
					<Check size={15} />
					Complete
				</span>
			)}
		</div>
	);
}
