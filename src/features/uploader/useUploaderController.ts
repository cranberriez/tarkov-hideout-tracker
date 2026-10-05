"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ItemSummary } from "@/types/items";
import { buildLabelIndex, summarizeDetections } from "./recognition-model";
import { readImageLabels, readScreenshot, type Screenshot } from "./image-recognition";

export function useUploaderController(items: readonly ItemSummary[] | undefined) {
	const [image, setImage] = useState<Screenshot | null>(null);
	const [labels, setLabels] = useState<Awaited<ReturnType<typeof readImageLabels>> | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [status, setStatus] = useState<{ label: string; progress: number } | null>(null);
	const [attempt, setAttempt] = useState(0);
	const selection = useRef(0);
	const activeRun = useRef<AbortController | null>(null);
	const completedScan = useRef<string | null>(null);
	const index = useMemo(() => buildLabelIndex(items ?? []), [items]);
	const detections = useMemo(() => labels?.detections ?? [], [labels]);
	const groups = useMemo(() => summarizeDetections(detections), [detections]);

	useEffect(
		() => () => {
			selection.current++;
		},
		[],
	);
	useEffect(
		() => () => {
			if (image) URL.revokeObjectURL(image.url);
		},
		[image],
	);
	const supplyImage = useCallback(async (file: File) => {
		const request = ++selection.current;
		activeRun.current?.abort();
		setLabels(null);
		setError(null);
		setStatus({ label: "Opening image", progress: 0 });
		try {
			const next = await readScreenshot(file);
			if (request !== selection.current) {
				URL.revokeObjectURL(next.url);
				return;
			}
			setImage(next);
			setStatus(null);
		} catch (cause) {
			if (request !== selection.current) return;
			setImage(null);
			setStatus(null);
			setError(cause instanceof Error ? cause.message : "This image could not be opened.");
		}
	}, []);

	useEffect(() => {
		if (!image || !items?.length) return;
		const runKey = `${image.url}:${attempt}`;
		// A background catalog refresh must not replace a player's ongoing review.
		if (completedScan.current === runKey) return;
		const controller = new AbortController();
		activeRun.current = controller;
		// Bound startup/download failures as well as unusually expensive screenshots.
		const timeout = window.setTimeout(
			() => controller.abort(new Error("Recognition took too long. Check your connection or try a smaller crop.")),
			90_000,
		);
		let disposed = false;
		const request = selection.current;
		const current = () => !disposed && request === selection.current;
		void readImageLabels(
			image,
			controller.signal,
			(label, progress) => {
				if (current()) {
					setStatus({ label, progress });
					setLabels(null);
				}
			},
			index,
		)
			.then((result) => {
				if (current()) {
					completedScan.current = runKey;
					setLabels(result);
					setError(null);
					setStatus(null);
				}
			})
			.catch((cause: unknown) => {
				if (current()) {
					completedScan.current = runKey;
					setError(cause instanceof Error ? cause.message : "Recognition failed. Check your connection and try again.");
					setStatus(null);
				}
			})
			.finally(() => {
				window.clearTimeout(timeout);
				if (current()) setStatus(null);
			});
		return () => {
			disposed = true;
			window.clearTimeout(timeout);
			controller.abort();
		};
	}, [image, attempt, index, items]);

	return {
		image,
		detections,
		groups,
		error,
		status,
		finished: !!labels,
		supplyImage,
		retry: () => {
			setError(null);
			setLabels(null);
			setAttempt((value) => value + 1);
		},
		clear: () => {
			selection.current++;
			activeRun.current?.abort();
			setImage(null);
			setLabels(null);
			setError(null);
			setStatus(null);
		},
	};
}
