"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { GAME_MODES, type GameMode } from "@/lib/game-mode";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useKappaStore } from "@/lib/stores/useKappaStore";
import { MAX_BACKUP_BYTES, parseProgressBackup, profileStatus, type ProgressBackup } from "./progress-backup";
import { importProgressBackup, readProgressBackup } from "./progress-backup-storage";

function subscribeHydration(notify: () => void) {
	const unsubscribeUser = useUserStore.persist?.onFinishHydration(notify);
	const unsubscribeKappa = useKappaStore.persist?.onFinishHydration(notify);
	return () => {
		unsubscribeUser?.();
		unsubscribeKappa?.();
	};
}
export function useProgressBackupController() {
	const ready = useSyncExternalStore(
		subscribeHydration,
		() => Boolean(useUserStore.persist?.hasHydrated() && useKappaStore.persist?.hasHydrated()),
		() => false,
	);
	const [dialog, setDialog] = useState(false);
	const [backup, setBackup] = useState<ProgressBackup | null>(null);
	const [current, setCurrent] = useState<ProgressBackup | null>(null);
	const [selected, setSelected] = useState<GameMode[]>([]);
	const [acknowledged, setAcknowledged] = useState(false);
	const [error, setError] = useState("");
	const [status, setStatus] = useState("");
	const [fileName, setFileName] = useState("");
	const [loading, setLoading] = useState(false);
	const request = useRef(0);
	const opener = useRef<HTMLElement | null>(null);

	function close() {
		request.current++;
		setDialog(false);
		setLoading(false);
	}
	function open() {
		opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		request.current++;
		setError("");
		setStatus("");
		setBackup(null);
		setCurrent(null);
		setSelected([]);
		setAcknowledged(false);
		setFileName("");
		setLoading(false);
		try {
			const snapshot = readProgressBackup(window.localStorage);
			setCurrent(snapshot);
			setDialog(true);
		} catch {
			setStatus("Browser storage is unavailable. Enable storage to back up your progress.");
		}
	}
	async function readFile(file: File | undefined) {
		if (!file) return;
		const id = ++request.current;
		setBackup(null);
		setSelected([]);
		setAcknowledged(false);
		setError("");
		setLoading(true);
		setFileName(file.name);
		try {
			if (file.size > MAX_BACKUP_BYTES) throw new Error("Backup is too large (maximum 10 MB).");
			const parsed = parseProgressBackup(await file.text());
			if (id !== request.current) return;
			const snapshot = readProgressBackup(window.localStorage);
			setCurrent(snapshot);
			setBackup(parsed);
			setSelected(
				GAME_MODES.filter(
					(mode) =>
						parsed.profiles[mode] && profileStatus(snapshot.profiles[mode]!, parsed.profiles[mode]!) === "empty",
				),
			);
		} catch (e) {
			if (id === request.current) setError(e instanceof Error ? e.message : "Could not read this file.");
		} finally {
			if (id === request.current) setLoading(false);
		}
	}
	const replacing = selected.some(
		(mode) =>
			backup?.profiles[mode] &&
			current?.profiles[mode] &&
			profileStatus(current.profiles[mode]!, backup.profiles[mode]!) === "replace",
	);
	function toggle(mode: GameMode) {
		setAcknowledged(false);
		setSelected((previous) =>
			previous.includes(mode) ? previous.filter((entry) => entry !== mode) : [...previous, mode],
		);
	}
	function exportBackup() {
		setStatus("");
		try {
			const text = JSON.stringify(readProgressBackup(window.localStorage), null, 2);
			parseProgressBackup(text);
			const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
			const link = document.createElement("a");
			link.href = url;
			link.download = `tarkov-progress-${new Date().toISOString().slice(0, 10)}.json`;
			link.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
			setStatus("Backup downloaded.");
		} catch (e) {
			setStatus(e instanceof Error ? e.message : "Could not export progress.");
		}
	}
	function submit() {
		if (!backup || !current || !selected.length || loading) return;
		setError("");
		try {
			if (replacing && !acknowledged) return;
			const count = importProgressBackup(backup, current, selected, window.localStorage);
			setStatus(
				count
					? `Imported progress for ${selected.join(", ")}.`
					: "Selected profiles are already up to date. Nothing was imported.",
			);
			close();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not save progress.");
		}
	}
	return {
		restoreFocus: () => opener.current?.focus(),
		ready,
		dialog,
		backup,
		current,
		selected,
		acknowledged,
		setAcknowledged,
		error,
		status,
		fileName,
		loading,
		replacing,
		open,
		exportBackup,
		close,
		readFile,
		toggle,
		submit,
	};
}
