import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Upload", "Classify", "Sort"] as const;
export const sectionLabel = "text-[10px] font-bold uppercase tracking-wide text-subtle-foreground";

/** Shared top of the uploader sidebar: step progress, current goal, and one status line. */
export function UploaderSidebarHeader({ step, title, detail }: { step: 0 | 1 | 2; title: string; detail?: ReactNode }) {
	return (
		<header className="-mx-4 -mt-4 border-b border-border-color bg-shadow/30 px-4 pb-4 pt-3">
			<ol className="flex items-center gap-1.5" aria-label="Uploader progress">
				{STEPS.map((label, index) => (
					<li
						key={label}
						aria-current={index === step ? "step" : undefined}
						className={cn(
							"flex flex-1 flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide",
							index === step ? "text-brand" : index < step ? "text-muted-foreground" : "text-subtle-foreground",
						)}
					>
						<span
							className={cn("h-0.5 rounded-full", index <= step ? "bg-brand" : "bg-highlight/10")}
							aria-hidden="true"
						/>
						<span className="flex items-center gap-1">
							{index < step && <Check size={10} aria-hidden="true" />}
							{label}
						</span>
					</li>
				))}
			</ol>
			<h1 className="mt-4 text-lg font-bold uppercase tracking-tight text-foreground">{title}</h1>
			{detail && (
				<p className="mt-0.5 text-xs text-muted-foreground" aria-live="polite">
					{detail}
				</p>
			)}
		</header>
	);
}
