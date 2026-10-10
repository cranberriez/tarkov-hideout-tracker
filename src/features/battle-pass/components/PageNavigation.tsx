import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "../battle-pass.module.css";

export function PageNavigation({
	first,
	lastStart,
	go,
}: {
	first: number;
	lastStart: number;
	go: (to: number) => void;
}) {
	return (
		<div className="flex items-center justify-center gap-2">
			<Button
				size="xs"
				variant="ghost"
				disabled={first === 0}
				aria-label="Previous page (Q)"
				onClick={() => go(first - 1)}
			>
				<ChevronLeft size={16} />
				Prev
				<kbd className={styles.kbd}>Q</kbd>
			</Button>
			<Button
				size="xs"
				variant="ghost"
				disabled={first >= lastStart}
				aria-label="Next page (E)"
				onClick={() => go(first + 1)}
			>
				<kbd className={styles.kbd}>E</kbd>
				Next
				<ChevronRight size={16} />
			</Button>
		</div>
	);
}
