import type { ItemSummary } from "@/types/items";
import type { IconImage } from "./icon-matching";
import type { buildLabelIndex, ItemDetection, LabelLine } from "./recognition-model";
import type { ReviewBox } from "./review-model";
import { labelVocabulary, scanLabels, type LabelReader } from "./scan-pipeline";

export interface Screenshot {
	url: string;
	name: string;
	width: number;
	height: number;
}

export async function readScreenshot(file: File): Promise<Screenshot> {
	if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
		throw new Error("Choose a PNG, JPEG, or WebP image.");
	if (file.size > 20 * 1024 * 1024) throw new Error("Choose an image smaller than 20 MB.");
	const bitmap = await createImageBitmap(file).catch(() => {
		throw new Error("This image could not be opened. Try another screenshot.");
	});
	try {
		if (bitmap.width * bitmap.height > 24_000_000 || Math.max(bitmap.width, bitmap.height) > 8192)
			throw new Error("This image is too large. Crop it to the stash area first.");
		return {
			url: URL.createObjectURL(file),
			name: file.name || "Pasted image",
			width: bitmap.width,
			height: bitmap.height,
		};
	} finally {
		bitmap.close();
	}
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
	return new Promise((resolve, reject) => {
		const abort = () => reject(signal.reason ?? new DOMException("Cancelled", "AbortError"));
		if (signal.aborted) abort();
		else signal.addEventListener("abort", abort, { once: true });
		promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
	});
}

export async function readImageLabels(
	screenshot: Screenshot,
	signal: AbortSignal,
	onProgress: (label: string, progress: number) => void,
	items: readonly ItemSummary[],
	index: ReturnType<typeof buildLabelIndex>,
): Promise<{ detections: ItemDetection[]; boxes: ReviewBox[] }> {
	onProgress("Loading recognition tools", 0);
	const { createWorker, PSM, OEM } = await abortable(import("tesseract.js"), signal);
	signal.throwIfAborted();
	onProgress("Preparing image", 0);
	const image = new Image();
	image.src = screenshot.url;
	await abortable(image.decode(), signal);
	const scale = Math.min(3, 4096 / Math.max(screenshot.width, screenshot.height));
	const canvas = document.createElement("canvas");
	canvas.width = Math.round(screenshot.width * scale);
	canvas.height = Math.round(screenshot.height * scale);
	const context = canvas.getContext("2d", { willReadFrequently: true });
	if (!context) throw new Error("Your browser could not prepare the image.");
	const scaled = await createImageBitmap(image, {
		resizeWidth: canvas.width,
		resizeHeight: canvas.height,
		resizeQuality: "high",
	});
	try {
		signal.throwIfAborted();
		context.drawImage(scaled, 0, 0);
	} finally {
		scaled.close();
	}
	const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
	let pageRead = true;
	const workerPromise = createWorker(
		"eng",
		OEM.LSTM_ONLY,
		{
			logger: ({ status, progress }) => {
				if (!signal.aborted && pageRead)
					onProgress(
						status === "recognizing text" ? "Reading item labels" : "Loading recognition tools",
						status === "recognizing text" ? progress : 0,
					);
			},
			// Surface worker failures through the returned promise, rather than throwing globally.
			errorHandler: () => {},
		},
		{ load_system_dawg: "0", load_freq_dawg: "0" },
	);
	const stop = () => {
		void workerPromise.then((worker) => worker.terminate()).catch(() => {});
	};
	signal.addEventListener("abort", stop, { once: true });
	const strip = document.createElement("canvas");
	try {
		const worker = await abortable(workerPromise, signal);
		await abortable(worker.writeText("/uploader-words.txt", labelVocabulary(index).join("\n")), signal);
		const vocabularyConfig = { load_system_dawg: "0", load_freq_dawg: "0", user_words_file: "/uploader-words.txt" };
		await abortable(worker.reinitialize("eng", OEM.LSTM_ONLY, vocabularyConfig), signal);
		const read = async (target: HTMLCanvasElement) => {
			const { data } = await abortable(worker.recognize(target, {}, { blocks: true, text: true }), signal);
			return collectLines(data.blocks);
		};
		const reader: LabelReader = {
			async readPage(rgba, width, height) {
				context.putImageData(new ImageData(rgba, width, height), 0, 0);
				await abortable(
					worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, user_defined_dpi: "300" }),
					signal,
				);
				const lines = await read(canvas);
				pageRead = false;
				await abortable(worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE }), signal);
				return lines;
			},
			async readStrip(gray) {
				strip.width = gray.width;
				strip.height = gray.height;
				const stripContext = strip.getContext("2d");
				if (!stripContext) throw new Error("Your browser could not prepare a label row.");
				const ink = stripContext.createImageData(gray.width, gray.height);
				for (let i = 0; i < gray.data.length; i++) {
					ink.data[i * 4] = ink.data[i * 4 + 1] = ink.data[i * 4 + 2] = gray.data[i];
					ink.data[i * 4 + 3] = 255;
				}
				stripContext.putImageData(ink, 0, 0);
				return read(strip);
			},
		};
		return await scanLabels(
			pixels.data,
			canvas.width,
			canvas.height,
			reader,
			items,
			index,
			(item) => loadGridIcon(item, signal),
			signal,
			onProgress,
		);
	} finally {
		signal.removeEventListener("abort", stop);
		stop();
		strip.width = strip.height = 0;
		canvas.width = canvas.height = 0;
	}
}

type OcrBlocks = Awaited<
	ReturnType<Awaited<ReturnType<typeof import("tesseract.js").createWorker>>["recognize"]>
>["data"]["blocks"];

export function collectLines(blocks: OcrBlocks): LabelLine[] {
	return (blocks ?? []).flatMap((block) =>
		block.paragraphs.flatMap((paragraph) =>
			paragraph.lines.map((line) => ({
				words: line.words.map(({ text, confidence, bbox }) => ({
					text,
					confidence,
					bbox: { x0: bbox.x0, x1: bbox.x1, y0: bbox.y0, y1: bbox.y1 },
				})),
			})),
		),
	);
}

/**
 * Catalog grid art through the same-origin `/item-assets` rewrite (next.config), since the
 * asset host sends no CORS headers and cross-origin pixels cannot be read from a canvas.
 */
async function loadGridIcon(item: ItemSummary, signal: AbortSignal): Promise<IconImage | null> {
	const response = await fetch(`/item-assets/${encodeURIComponent(item.id)}-grid-image.webp`, { signal });
	if (!response.ok) return null;
	const bitmap = await createImageBitmap(await response.blob());
	try {
		const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
		const context = canvas.getContext("2d", { willReadFrequently: true });
		if (!context) return null;
		context.drawImage(bitmap, 0, 0);
		const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
		return { data, width: bitmap.width, height: bitmap.height };
	} finally {
		bitmap.close();
	}
}
