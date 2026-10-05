"use client";

/* eslint-disable @next/next/no-img-element -- Local screenshot preview. */
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { toTarkovJsonGameMode, type TarkovJsonGameMode } from "@/lib/game-mode";
import { useUserStoreHydrated } from "@/lib/query/game-data";
import { useSearchManifest } from "@/lib/search/useSearchManifest";
import { useUserStore } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";
import { useUploaderController } from "./useUploaderController";
import { KeyHint, UploaderReview } from "./UploaderReview";
import styles from "./UploaderReview.module.css";
import { UploaderSidebarHeader } from "./UploaderSidebarHeader";

export function UploaderClientPage() {
	const hydrated = useUserStoreHydrated();
	const gameMode = useUserStore((state) => state.gameMode);
	useEffect(() => {
		document.body.classList.add("uploader-workspace-active");
		return () => document.body.classList.remove("uploader-workspace-active");
	}, []);
	if (!hydrated)
		return (
			<main className="flex min-h-0 flex-1 items-end bg-background p-3 text-xs text-muted-foreground" role="status">
				Loading uploader…
			</main>
		);
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
	const reviewing = image && !status && (finished || error) && catalog.data;
	const actions = (
		<div className="flex items-center gap-2 text-xs text-muted-foreground">
			<button
				onClick={() => input.current?.click()}
				className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border-color bg-surface-raised px-3 py-2 hover:border-brand/50 hover:text-foreground"
			>
				<Upload size={14} aria-hidden="true" />
				{image ? "Change image" : "Choose image"}
			</button>
			{image && (
				<button
					onClick={controller.clear}
					aria-label="Clear screenshot"
					title="Clear screenshot"
					className="rounded-md border border-border-color p-2 hover:border-danger/50 hover:bg-danger/10 hover:text-danger"
				>
					<Trash2 size={16} aria-hidden="true" />
				</button>
			)}
		</div>
	);
	const bottomBar = (
		<div className="col-start-1 row-start-2 min-w-0 border-t border-border-color bg-surface-raised/40">
			{(error || catalog.error) && (
				<div role="alert" className="bg-danger/10 px-3 py-2 text-xs text-danger">
					{error}
					{catalog.error && (
						<>
							{" "}
							Item catalog unavailable. {catalog.error.message}{" "}
							<button onClick={() => void catalog.retry()} className="underline">
								Retry catalog
							</button>
						</>
					)}
					{error && image && (
						<button onClick={controller.retry} className="ml-2 underline">
							Retry scan
						</button>
					)}
				</div>
			)}
			<footer className="shrink-0 px-3 py-2 text-[11px] text-muted-foreground" aria-live="polite">
				{status ? (
					<div className="flex items-center gap-3">
						<span>
							{status.label} · {Math.round(status.progress * 100)}%
						</span>
						<progress
							value={status.progress}
							max={1}
							aria-label="Recognition progress"
							className="h-1 min-w-12 flex-1 accent-brand"
						/>
					</div>
				) : reviewing ? (
					<p>
						Click any item · <KeyHint>Ctrl / ⌘</KeyHint> + click to multi-select unknowns · <KeyHint>Shift</KeyHint> +
						click for unknowns in range{" "}
						<span className="ml-4">
							<KeyHint>→</KeyHint> Next unknown · <KeyHint>Enter</KeyHint> Use suggestion · <KeyHint>F</KeyHint> Toggle
							FIR
						</span>
					</p>
				) : image && !catalog.data && !catalog.error ? (
					"Loading item catalog…"
				) : (
					"Ctrl+V Paste screenshot · Drop an image anywhere"
				)}
			</footer>
		</div>
	);
	return (
		<main
			className={cn(
				"flex min-h-0 flex-1 flex-col overflow-hidden bg-background",
				dragging && "ring-2 ring-inset ring-brand",
			)}
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
		>
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
			{reviewing && catalog.data ? (
				<UploaderReview
					key={image.url}
					image={image}
					detections={detections}
					items={catalog.data.items}
					imageActions={actions}
					bottomBar={bottomBar}
				/>
			) : (
				<div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] grid-cols-[minmax(0,1fr)_20rem] max-sm:grid-cols-[minmax(0,1fr)_15rem]">
					<div
						className="relative flex min-h-0 items-center justify-center overflow-hidden bg-shadow/30 p-4"
						aria-busy={!!image && !error && !catalog.error}
					>
						{image ? (
							<img src={image.url} alt="Uploaded stash screenshot" className="max-h-full max-w-full object-contain" />
						) : (
							<div className="text-center text-muted-foreground">
								<ImagePlus size={32} className="mx-auto mb-4" aria-hidden="true" />
								<p className="text-sm">Drop a screenshot or paste with Ctrl+V</p>
							</div>
						)}
						{image && !error && !catalog.error && (
							<div className="pointer-events-none absolute inset-0 overflow-hidden bg-shadow/50">
								<div
									aria-hidden="true"
									className={cn(
										"absolute inset-x-0 top-0 h-24 border-b border-brand/60 bg-gradient-to-b from-transparent to-brand/15",
										styles.scan,
									)}
								/>
							</div>
						)}
					</div>
					<aside className="col-start-2 row-start-1 row-span-2 flex min-h-0 flex-col overflow-y-auto border-l border-border-color bg-card p-4">
						<UploaderSidebarHeader
							step={0}
							title={image ? "Reading screenshot" : "Upload screenshot"}
							detail={image ? "Matching item labels in your browser" : "A stash, junkbox, or fresh loot"}
						/>
						<button
							onClick={() => input.current?.click()}
							className="mt-4 rounded-md border border-brand bg-brand px-3 py-2 text-sm font-medium text-inverse hover:bg-brand-hover"
						>
							Choose image
						</button>
						<p className="mt-3 text-xs text-muted-foreground">PNG, JPEG or WebP · Up to 20 MB</p>
						{image && (
							<div className="-mx-4 -mb-4 mt-auto border-t border-border-color bg-surface-raised/40 p-4">{actions}</div>
						)}
					</aside>
					{bottomBar}
				</div>
			)}
		</main>
	);
}
