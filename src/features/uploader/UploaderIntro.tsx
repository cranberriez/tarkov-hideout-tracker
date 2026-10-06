"use client";

import Image from "next/image";
import { Check, ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { KeyHint, sectionLabel } from "./UploaderSidebarHeader";

// Mirrors the scan-quality hints so the examples teach what the scanner actually flags.
const EXAMPLES = [
	{
		good: true,
		src: "/images/uploader/good-image.png",
		title: "One container, full resolution",
		detail: "Sharp PNG, English item names, at least four rows",
	},
	{
		good: false,
		src: "/images/uploader/bad-image1.png",
		title: "Whole screen",
		detail: "Several containers and menu text get misread",
	},
	{
		good: false,
		src: "/images/uploader/bad-image2.png",
		title: "Resized or compressed",
		detail: "Stream captures and shrunk images read poorly",
	},
] as const;

/**
 * First-run tutorial shown in place of the empty drop area until a scan reaches the Sort step.
 * Drops anywhere on the page are handled by the uploader, so the drop zone only needs to look the part.
 */
export function UploaderIntro({ dragging, onChooseImage }: { dragging: boolean; onChooseImage: () => void }) {
	return (
		<div className="absolute inset-0 overflow-y-auto">
			<div className="mx-auto flex min-h-full max-w-5xl flex-col justify-center gap-6 px-6 py-8">
				<header>
					<p className="flex items-center gap-2">
						<span className="rounded-sm border border-brand/40 bg-brand/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-brand">
							Beta
						</span>
						<span className="text-xs text-muted-foreground">Some items may need a manual fix during review</span>
					</p>
					<h2 className="mt-3 text-2xl font-bold uppercase tracking-tight text-foreground">Scan your loot</h2>
					<p className="mt-1 max-w-xl text-sm text-muted-foreground">
						Item names are read in your browser; your screenshot is never uploaded. Nothing is saved to your inventory
						until you choose to send it.
					</p>
				</header>
				<section aria-label="Screenshot examples">
					<h3 className={sectionLabel}>What works best</h3>
					<ul className="mt-2 grid gap-3 sm:grid-cols-3">
						{EXAMPLES.map((example) => (
							<li
								key={example.src}
								className={cn(
									"overflow-hidden rounded-md border bg-card",
									example.good ? "border-success/50" : "border-danger/40",
								)}
							>
								<div className="relative aspect-[4/3] bg-shadow/40">
									<Image
										src={example.src}
										alt={example.title}
										fill
										sizes="(min-width: 640px) 22rem, 100vw"
										className="object-cover object-left-top"
									/>
								</div>
								<div className="p-3">
									<p
										className={cn(
											"flex items-center gap-1.5 text-xs font-semibold",
											example.good ? "text-success" : "text-danger",
										)}
									>
										{example.good ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
										<span className="sr-only">{example.good ? "Good:" : "Avoid:"}</span>
										{example.title}
									</p>
									<p className="mt-1 text-[11px] text-muted-foreground">{example.detail}</p>
								</div>
							</li>
						))}
					</ul>
				</section>
				<p className="text-xs text-muted-foreground">
					<KeyHint>Win</KeyHint> + <KeyHint>Shift</KeyHint> + <KeyHint>S</KeyHint> snips a region on Windows, then{" "}
					<KeyHint>Ctrl</KeyHint> + <KeyHint>V</KeyHint> pastes it here.
				</p>
				<button
					type="button"
					onClick={onChooseImage}
					className={cn(
						"flex items-center justify-center gap-3 rounded-md border-2 border-dashed px-4 py-6 text-sm transition-colors",
						dragging
							? "border-brand bg-brand/10 text-foreground"
							: "border-highlight/20 text-muted-foreground hover:border-brand/50 hover:text-foreground",
					)}
				>
					<ImagePlus size={20} aria-hidden="true" />
					Drop a screenshot here or click to choose one
				</button>
			</div>
		</div>
	);
}
