import React from "react";
import { ChevronDown } from "lucide-react";

interface NewsPostProps {
	title: string;
	date: string;
	version: string;
	/** Older posts are collapsed by default; the latest sets this. */
	defaultOpen?: boolean;
	children: React.ReactNode;
}

export function NewsPost({ title, date, version, defaultOpen = false, children }: NewsPostProps) {
	return (
		<details id={`v${version}`} open={defaultOpen} className="group rounded-lg border bg-card scroll-mt-20">
			<summary className="flex cursor-pointer list-none flex-col justify-between gap-2 p-5 sm:flex-row sm:items-end sm:p-7 [&::-webkit-details-marker]:hidden">
				<div className="flex flex-col gap-1">
					<h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h2>
					<span className="font-mono text-xs text-muted-foreground">v{version}</span>
				</div>
				<div className="flex items-center gap-3">
					<time className="text-xs font-medium text-muted-foreground sm:text-sm">{date}</time>
					<ChevronDown
						size={18}
						aria-hidden
						className="text-muted-foreground transition-transform group-open:rotate-180"
					/>
				</div>
			</summary>
			<div
				className={[
					"mx-5 flex flex-col gap-5 border-t border-border/50 pb-5 pt-6 sm:mx-7 sm:pb-7",
					"text-[15px] leading-7 text-foreground/85",
					"[&_a]:font-medium [&_a]:underline-offset-4",
					"[&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:leading-7",
					"[&_li]:leading-7 [&_p]:leading-7",
					"[&_ul]:space-y-2 [&_ul]:pl-5",
				].join(" ")}
			>
				{children}
			</div>
		</details>
	);
}
