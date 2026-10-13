"use client";

import { useState } from "react";
import { useCompanionSyncStore } from "@/lib/stores/useCompanionSyncStore";
import { cn } from "@/lib/utils";
import { formatClock } from "./sync-view-utils";

/** Companion HTTP exchanges for this session, newest first. */
export function RawProtocolView() {
	const exchanges = useCompanionSyncStore((state) => state.exchanges);
	const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

	return (
		<div>
			<p className="mb-2 text-xs text-subtle-foreground">This session only</p>
			{exchanges.length === 0 ? (
				<p className="py-6 text-sm text-muted-foreground">No requests yet.</p>
			) : (
				<ul className="divide-y divide-highlight/10 font-mono text-xs">
					{exchanges.map((exchange) => {
						const key = `${exchange.at}|${exchange.method}|${exchange.path}|${exchange.summary}`;
						const expanded = open.has(key);
						const ok = typeof exchange.status === "number" && exchange.status < 400;
						return (
							<li key={key}>
								<button
									type="button"
									aria-expanded={expanded}
									disabled={!exchange.body}
									onClick={() =>
										setOpen((current) => {
											const next = new Set(current);
											if (!next.delete(key)) next.add(key);
											return next;
										})
									}
									className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5 text-left hover:bg-highlight/5 disabled:cursor-default disabled:hover:bg-transparent"
								>
									<span className="text-subtle-foreground">{formatClock(exchange.at, true)}</span>
									<span className="w-12 text-muted-foreground">{exchange.method}</span>
									<span className="text-foreground">{exchange.path}</span>
									<span className={cn("font-semibold", ok ? "text-success" : "text-danger")}>{exchange.status}</span>
									<span className="text-subtle-foreground">{exchange.ms}ms</span>
									<span className="text-muted-foreground">{exchange.summary}</span>
								</button>
								{expanded && (
									<pre className="mb-2 max-h-64 overflow-auto rounded bg-highlight/5 p-2 text-[11px] leading-snug text-muted-foreground">
										{exchange.body}
									</pre>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
