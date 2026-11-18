import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { syncValue } from "./field";

/** Flat collapsible section: a full-width summary row with an optional right-aligned headline value. */
export function Disclosure({
	title,
	icon,
	meta,
	defaultOpen = false,
	syncing = false,
	className,
	children,
}: {
	title: ReactNode;
	icon?: ReactNode;
	meta?: ReactNode;
	defaultOpen?: boolean;
	/** Marks shown values as stale while a recalculation is running. */
	syncing?: boolean;
	className?: string;
	children: ReactNode;
}) {
	return (
		<details
			open={defaultOpen}
			aria-busy={syncing || undefined}
			data-syncing={syncing}
			className={cn("group/disc group/sync rounded-lg bg-surface-raised/30", className)}
		>
			<summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-4 py-3 transition-colors hover:bg-surface-raised/50 focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
				<ChevronRight
					className="size-4 shrink-0 text-muted-foreground transition-transform group-open/disc:rotate-90"
					aria-hidden
				/>
				{icon}
				<span className="text-sm font-semibold">{title}</span>
				{meta && <span className={cn("ml-auto text-right text-xs text-muted-foreground", syncValue)}>{meta}</span>}
			</summary>
			<div className="space-y-4 px-4 pt-1 pb-4">{children}</div>
		</details>
	);
}

/** Smaller nested expansion for secondary detail inside a section. */
export function SubDisclosure({ title, children }: { title: ReactNode; children: ReactNode }) {
	return (
		<details className="group/sub">
			<summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
				<ChevronRight className="size-3.5 transition-transform group-open/sub:rotate-90" aria-hidden />
				{title}
			</summary>
			<div className="mt-2">{children}</div>
		</details>
	);
}
