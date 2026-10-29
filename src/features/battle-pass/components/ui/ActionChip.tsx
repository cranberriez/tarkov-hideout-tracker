import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "../../battle-pass.module.css";

export function ActionChip({
	active,
	label,
	accessibleLabel,
	icon,
	onClick,
	tone,
}: {
	active: boolean;
	label: string;
	accessibleLabel: string;
	icon: ReactNode;
	onClick: () => void;
	tone: "goal" | "done" | "avoid";
}) {
	return (
		<button
			type="button"
			aria-label={accessibleLabel}
			aria-pressed={active}
			onClick={onClick}
			className={cn(
				styles.chip,
				styles.action,
				styles.end,
				tone === "avoid"
					? "text-danger"
					: active
						? tone === "goal"
							? "text-brand"
							: "text-success"
						: "text-muted-foreground",
			)}
		>
			<span className={styles.chipInner}>
				<span className={cn(styles.face, "w-9 justify-center")}>{icon}</span>
				<span className={styles.label}>{label}</span>
			</span>
		</button>
	);
}
