import { useEffect, useState } from "react";

export function useNow(intervalMs: number): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), intervalMs);
		return () => clearInterval(timer);
	}, [intervalMs]);
	return now;
}

/** "5s ago", "3m ago", "2h ago", "4d ago"; empty for unparsable input. */
export function relativeAge(at: number | string, now: number): string {
	const time = typeof at === "number" ? at : Date.parse(at);
	if (Number.isNaN(time)) return "";
	const seconds = Math.max(0, Math.round((now - time) / 1000));
	if (seconds < 60) return `${seconds}s ago`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
	if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
	return `${Math.floor(seconds / 86_400)}d ago`;
}

export function formatClock(at: number | string, seconds = false): string {
	const date = new Date(at);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {}) });
}

/** "Today", "Yesterday", else a short date. */
export function dayLabel(at: string, now: number): string {
	const date = new Date(at);
	if (Number.isNaN(date.getTime())) return "Earlier";
	const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
	const diffDays = Math.round((startOfDay(new Date(now)) - startOfDay(date)) / 86_400_000);
	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Yesterday";
	return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}
