import { detectFoundInRaid } from "./found-in-raid";
import { detectItemFootprints } from "./item-footprints";
import {
	inferLabelGrid,
	mergeLabelPasses,
	recognizeLabels,
	type buildLabelIndex,
	type ItemDetection,
	type LabelLine,
} from "./recognition-model";
import { buildLabelTasks, prepareLabelPixels } from "./label-preprocessing";

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
	index: ReturnType<typeof buildLabelIndex>,
): Promise<{ detections: ItemDetection[] }> {
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
	// Invert light stash labels into dark text on a light background for OCR.
	const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
	const originalPixels = pixels.data.slice();
	const masks = prepareLabelPixels(pixels.data);
	context.putImageData(pixels, 0, 0);
	onProgress("Loading recognition tools", 0);
	let readingLabel = "Reading item labels";
	let completedRows = 0;
	let totalRows = 1;
	const workerPromise = createWorker(
		"eng",
		OEM.LSTM_ONLY,
		{
			logger: ({ status, progress }) => {
				if (!signal.aborted)
					onProgress(
						status === "recognizing text" ? readingLabel : "Loading recognition tools",
						status === "recognizing text" ? (completedRows + progress) / totalRows : 0,
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
	try {
		const worker = await abortable(workerPromise, signal);
		const vocabulary = [
			...new Set(
				[...index.values()].flatMap((items) =>
					items.flatMap((item) => (item.shortName ?? "").split(/\s+/).filter(Boolean)),
				),
			),
		];
		await abortable(worker.writeText("/uploader-words.txt", vocabulary.join("\n")), signal);
		const vocabularyConfig = { load_system_dawg: "0", load_freq_dawg: "0", user_words_file: "/uploader-words.txt" };
		await abortable(worker.reinitialize("eng", OEM.LSTM_ONLY, vocabularyConfig), signal);
		await abortable(worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, user_defined_dpi: "300" }), signal);
		const { data } = await abortable(worker.recognize(canvas, {}, { blocks: true, text: true }), signal);
		const collect = (blocks: typeof data.blocks, left = 0, top = 0): LabelLine[] =>
			(blocks ?? []).flatMap((block) =>
				block.paragraphs.flatMap((paragraph) =>
					paragraph.lines.map((line) => ({
						words: line.words.map(({ text, confidence, bbox }) => ({
							text,
							confidence,
							bbox: { x0: bbox.x0 + left, x1: bbox.x1 + left, y0: bbox.y0 + top, y1: bbox.y1 + top },
						})),
					})),
				),
			);
		const lines = collect(data.blocks);
		const firstMatches = recognizeLabels(lines, index, canvas.width, canvas.height);
		let detections = firstMatches;
		const grid = inferLabelGrid(firstMatches, canvas.height);
		if (grid) {
			onProgress("Refining grid labels", 0);
			// Isolate label-sized ink regions so grid borders and neighboring item art cannot
			// become prefixes on the label. A neutral-color pass also removes tinted outlines.
			await abortable(worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE }), signal);
			const tasks = buildLabelTasks(masks, canvas.width, canvas.height, grid);
			const strip = document.createElement("canvas");
			const margin = Math.max(8, Math.round(grid.textHeight / 2));
			const refinedLines: LabelLine[] = [];
			readingLabel = "Reading isolated item labels";
			totalRows = tasks.length || 1;
			try {
				for (const [row, task] of tasks.entries()) {
					signal.throwIfAborted();
					completedRows = row;
					onProgress(readingLabel, row / totalRows);
					strip.width = task.region.width + margin * 2;
					strip.height = task.region.height + margin * 2;
					const stripContext = strip.getContext("2d");
					if (!stripContext) throw new Error("Your browser could not prepare a label row.");
					const ink = stripContext.createImageData(strip.width, strip.height);
					ink.data.fill(255);
					for (let y = 0; y < task.region.height; y++)
						for (let x = 0; x < task.region.width; x++) {
							const source = (y + task.region.top) * canvas.width + x + task.region.left;
							const target = ((y + margin) * strip.width + x + margin) * 4;
							ink.data[target] = ink.data[target + 1] = ink.data[target + 2] = task.mask[source];
						}
					stripContext.putImageData(ink, 0, 0);
					const refined = await abortable(worker.recognize(strip, {}, { blocks: true, text: true }), signal);
					refinedLines.push(
						...collect(refined.data.blocks, task.region.left - margin, task.top + task.region.top - margin),
					);
				}
			} finally {
				strip.width = strip.height = 0;
			}
			// Keep low-confidence exact spellings visible for review, but do not count them
			// as certain identities unless another pass produces a stronger matching read.
			const refinedMatches = recognizeLabels(refinedLines, index, canvas.width, canvas.height, 0);
			detections = mergeLabelPasses(firstMatches, refinedMatches, grid, canvas.height);
		}
		return {
			detections: detectFoundInRaid(
				originalPixels,
				canvas.width,
				canvas.height,
				detectItemFootprints(originalPixels, canvas.width, canvas.height, detections),
			),
		};
	} finally {
		signal.removeEventListener("abort", stop);
		stop();
		canvas.width = canvas.height = 0;
	}
}
