import type { ReactNode, Ref } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
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

interface StepAction {
	label: string;
	onClick: () => void;
	disabled?: boolean;
}

/** Shared bottom navigation: back on the left, the primary forward step on the right. */
export function UploaderStepNav({
	back,
	forward,
	note,
	backRef,
}: {
	back?: StepAction;
	forward?: StepAction;
	note?: ReactNode;
	/** Receives focus when a step opens with only a way back. */
	backRef?: Ref<HTMLButtonElement>;
}) {
	if (!back && !forward) return null;
	return (
		<nav aria-label="Uploader steps" className="-mx-4 shrink-0 border-t border-border-color px-4 py-3">
			{note && <p className="mb-2 text-[11px] text-muted-foreground">{note}</p>}
			<div className="flex gap-2">
				{back && (
					<button
						ref={backRef}
						onClick={back.onClick}
						disabled={back.disabled}
						className={cn(
							"flex items-center justify-center gap-1.5 rounded-sm border border-highlight/10 bg-shadow/20 px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:border-highlight/30 disabled:opacity-40",
							!forward && "flex-1",
						)}
					>
						<ArrowLeft size={14} aria-hidden="true" />
						{back.label}
					</button>
				)}
				{forward && (
					<button
						onClick={forward.onClick}
						disabled={forward.disabled}
						className="flex flex-1 items-center justify-between gap-1.5 rounded-sm border border-brand bg-brand px-3 py-2.5 text-sm font-semibold text-inverse transition-colors hover:bg-brand-hover disabled:opacity-40"
					>
						{forward.label}
						<ArrowRight size={16} aria-hidden="true" />
					</button>
				)}
			</div>
		</nav>
	);
}

export function KeyHint({ children }: { children: ReactNode }) {
	return (
		<kbd className="inline-flex min-h-5 min-w-5 items-center justify-center rounded border border-b-2 border-border-color bg-background px-1.5 font-mono text-[10px] leading-4 text-muted-foreground shadow-sm">
			{children}
		</kbd>
	);
}
