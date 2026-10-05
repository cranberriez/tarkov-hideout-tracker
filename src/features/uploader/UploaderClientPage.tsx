"use client";

/* eslint-disable @next/next/no-img-element -- Local screenshot preview. */
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Upload, X } from "lucide-react";
import { RouteLoader } from "@/components/core/RouteLoader";
import { toTarkovJsonGameMode, type TarkovJsonGameMode } from "@/lib/game-mode";
import { useUserStoreHydrated } from "@/lib/query/game-data";
import { useSearchManifest } from "@/lib/search/useSearchManifest";
import { useUserStore } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";
import { useUploaderController } from "./useUploaderController";
import { UploaderReview } from "./UploaderReview";

export function UploaderClientPage() {
	const hydrated = useUserStoreHydrated();
	const gameMode = useUserStore((state) => state.gameMode);
	if (!hydrated) return <RouteLoader page="items" title="Screenshot uploader" />;
	return <UploaderView key={gameMode} mode={toTarkovJsonGameMode(gameMode)} />;
}

function UploaderView({ mode }: { mode: TarkovJsonGameMode }) {
	const catalog = useSearchManifest(mode, true);
	const controller = useUploaderController(catalog.data?.items);
	const { image, detections, status, error, finished, supplyImage } = controller;
	const input = useRef<HTMLInputElement>(null);
	const [dragging, setDragging] = useState(false);
	useEffect(() => {
		const paste = (event: ClipboardEvent) => {
			const file = Array.from(event.clipboardData?.items ?? [])
				.find((entry) => entry.kind === "file" && entry.type.startsWith("image/"))
				?.getAsFile();
			if (!file) return;
			event.preventDefault();
			void supplyImage(file);
		};
		window.addEventListener("paste", paste);
		return () => window.removeEventListener("paste", paste);
	}, [supplyImage]);
	return (
		<main className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
			<h1 className="text-2xl font-semibold tracking-tight text-foreground">Screenshot uploader</h1>
			<p className="mt-2 text-sm text-muted-foreground">Scan your stash, review the items, then finish your list.</p>
			<p className="mb-6 mt-1 text-xs text-subtle-foreground">
				Image processing stays in your browser · Inventory is unchanged · Reviews stay on this page
			</p>
			<input
				ref={input}
				type="file"
				accept="image/png,image/jpeg,image/webp"
				className="sr-only"
				aria-label="Choose stash screenshot"
				onChange={(event) => {
					const file = event.target.files?.[0];
					if (file) void supplyImage(file);
					event.target.value = "";
				}}
			/>
			<div
				onDragOver={(event) => {
					event.preventDefault();
					setDragging(true);
				}}
				onDragLeave={(event) => {
					if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
				}}
				onDrop={(event) => {
					event.preventDefault();
					setDragging(false);
					const file = event.dataTransfer.files[0];
					if (file) void supplyImage(file);
				}}
				className={cn(
					"rounded-lg border bg-card",
					dragging ? "border-brand ring-2 ring-brand/30" : "border-border-color",
				)}
			>
				{!image ? (
					<div className="flex min-h-64 flex-col items-center justify-center gap-4 p-8 text-center">
						<ImagePlus size={32} className="text-muted-foreground" aria-hidden="true" />
						<p className="text-sm text-muted-foreground">Paste with Ctrl+V, drop an image here, or</p>
						<button
							type="button"
							onClick={() => input.current?.click()}
							className="inline-flex items-center gap-2 rounded bg-brand px-4 py-2 text-sm font-medium text-inverse hover:bg-brand-hover"
						>
							<Upload size={16} aria-hidden="true" />
							Choose image
						</button>
						<p className="text-xs text-subtle-foreground">
							PNG, JPEG, WebP · Up to 20 MB · Crop to one container for better results
						</p>
					</div>
				) : (
					<>
						<div className="flex flex-wrap items-center gap-3 border-b border-border-color px-4 py-3">
							<span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{image.name}</span>
							<button
								type="button"
								onClick={() => input.current?.click()}
								className="text-xs text-brand hover:underline"
							>
								Change image (new review)
							</button>
							<button
								type="button"
								onClick={controller.clear}
								aria-label="Clear image and review"
								className="rounded p-1 text-muted-foreground hover:bg-surface-raised hover:text-foreground"
							>
								<X size={16} />
							</button>
						</div>
						{!status && (finished || error) && catalog.data ? (
							<UploaderReview image={image} detections={detections} items={catalog.data.items} mode={mode} />
						) : (
							<div className="p-4">
								<img
									src={image.url}
									alt="Uploaded stash screenshot"
									className="mx-auto max-h-[65vh] max-w-full rounded"
								/>
								<p className="mt-3 text-sm text-muted-foreground">
									{status ? "Reading screenshot…" : "Waiting for item catalog…"}
								</p>
							</div>
						)}
					</>
				)}
			</div>
			<div className="mt-4 space-y-3" aria-live="polite">
				{status && (
					<div>
						<p className="text-sm text-muted-foreground">
							{status.label}
							{status.progress > 0 ? ` · ${Math.round(status.progress * 100)}%` : "…"}
						</p>
						<progress
							value={status.progress}
							max={1}
							aria-label="Recognition progress"
							className="mt-2 h-1 w-full accent-brand"
						/>
					</div>
				)}
				{error && (
					<p role="alert" className="text-sm text-danger">
						{error}
						{image && " Try another screenshot if no reviewable items were found."}
					</p>
				)}
				{catalog.error && (
					<p role="alert" className="text-sm text-danger">
						Item catalog unavailable. {catalog.error.message}{" "}
						<button type="button" onClick={() => void catalog.retry()} className="underline">
							Retry catalog
						</button>
					</p>
				)}
			</div>
			<p className="mt-6 text-xs text-subtle-foreground">
				Check the entire screenshot before finishing. Filled boxes help reveal missed items; try a clearer screenshot if
				gaps remain. Stack quantities are not read automatically. FIR badge detections can be corrected during review.
			</p>
		</main>
	);
}
