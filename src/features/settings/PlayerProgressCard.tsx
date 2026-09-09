"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, FileJson, ShieldCheck } from "lucide-react";
import { GAME_MODES } from "@/lib/game-mode";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { comparisonRows, profileStatus } from "./progress-backup";
import { useProgressBackupController } from "./useProgressBackupController";

const button =
	"inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-gray-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-tarkov-green disabled:cursor-not-allowed disabled:opacity-40";
const primary = `${button} border-tarkov-green/30 bg-tarkov-green/10 text-tarkov-green hover:bg-tarkov-green/20`;
function summary(value: unknown): string {
	if (value === null) return "Not set";
	if (typeof value === "boolean") return value ? "Yes" : "No";
	if (typeof value === "object") {
		const count = Object.keys(value as object).length;
		return count
			? `${count.toLocaleString()} ${Array.isArray(value) ? "event" : "record"}${count === 1 ? "" : "s"}`
			: "None";
	}
	return String(value);
}

export function PlayerProgressCard() {
	const c = useProgressBackupController();
	const [dragging, setDragging] = useState(false);
	return (
		<>
			<section className="overflow-hidden rounded-lg border border-[#c7b99b]/25 bg-card">
				<div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
					<div className="flex items-center gap-3">
						<div className="rounded-md border border-[#c7b99b]/20 bg-[#c7b99b]/10 p-2.5 text-[#c7b99b]">
							<ShieldCheck size={21} />
						</div>
						<div>
							<h2 className="text-sm font-semibold text-white">Player progress</h2>
							<p className="mt-1 text-xs text-gray-400">Your characters. One portable backup.</p>
						</div>
					</div>
					<div className="flex gap-2">
						<button className={button} disabled={!c.ready} onClick={c.open}>
							<ArrowUpFromLine size={14} />
							Import file
						</button>
						<button className={primary} disabled={!c.ready} onClick={c.exportBackup}>
							<ArrowDownToLine size={14} />
							Export backup
						</button>
					</div>
				</div>
				<div className="space-y-4 px-5 py-4">
					<p className="max-w-2xl text-xs leading-5 text-gray-400">
						Back up or transfer stored items, hideout upgrades, quests, Kappa completion, character details, and skills.
						Review each profile before importing.
					</p>
					<div className="grid grid-cols-3 gap-2">
						{GAME_MODES.map((mode) => (
							<div
								key={mode}
								className="flex flex-col gap-1 rounded-md border border-white/8 bg-black/15 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
							>
								<span className="text-xs font-semibold tracking-wider text-[#c7b99b]">{mode}</span>
								<span className="text-[10px] text-gray-500">Separate profile</span>
							</div>
						))}
					</div>
					{c.status && (
						<p role="status" className="text-xs text-tarkov-green">
							{c.status}
						</p>
					)}
				</div>
			</section>

			<Dialog open={c.dialog} onOpenChange={(open) => !open && c.close()}>
				<DialogContent
					showCloseButton={false}
					className={`flex max-h-[90dvh] flex-col overflow-hidden p-0 ${c.backup ? "max-w-[min(48rem,calc(100%-2rem))]" : "max-w-[min(30rem,calc(100%-2rem))]"}`}
					onCloseAutoFocus={(event) => {
						event.preventDefault();
						c.restoreFocus();
					}}
				>
					<DialogTitle className="sr-only">Import player progress</DialogTitle>
					<DialogDescription className="sr-only">Choose a backup and review the profiles to import.</DialogDescription>
					<div className="min-h-0 space-y-3 overflow-y-auto p-4">
						<label
							className={`relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed text-center transition-colors focus-within:ring-2 focus-within:ring-tarkov-green ${dragging ? "border-tarkov-green bg-tarkov-green/10" : "border-white/20 bg-white/[0.02] hover:bg-white/5"} ${c.fileName ? "px-4 py-4" : "px-6 py-12"}`}
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
								void c.readFile(event.dataTransfer.files[0]);
							}}
						>
							<input
								type="file"
								accept=".json,application/json"
								aria-label="Choose a progress backup"
								className="sr-only"
								onChange={(event) => {
									void c.readFile(event.target.files?.[0]);
									event.target.value = "";
								}}
							/>
							<FileJson size={22} className="shrink-0 text-[#c7b99b]" />
							<span className="max-w-full break-all text-sm font-medium text-gray-200">
								{c.fileName || "Drop your backup here"}
							</span>
							<span className="text-xs text-gray-500">
								{c.fileName ? "Drop another file or click to replace" : "or click to browse"}
							</span>
						</label>
						{c.loading && (
							<p role="status" className="text-sm text-gray-400">
								Reading and validating backup…
							</p>
						)}
						{c.error && (
							<p
								role="alert"
								className="rounded border border-red-400/25 bg-red-400/10 p-3 text-xs leading-5 text-red-200"
							>
								{c.error}
							</p>
						)}
						{c.backup && c.current && (
							<>
								{GAME_MODES.map((mode) => {
									const incoming = c.backup!.profiles[mode];
									if (!incoming)
										return (
											<p key={mode} className="text-xs text-gray-500">
												{mode} · Not in backup
											</p>
										);
									const old = c.current!.profiles[mode]!;
									const state = profileStatus(old, incoming);
									const same = state === "up-to-date";
									const rows = comparisonRows(old, incoming);
									return (
										<section
											key={mode}
											className={`overflow-hidden rounded-md border ${c.selected.includes(mode) ? "border-tarkov-green/30" : "border-white/10"}`}
										>
											<label className="flex cursor-pointer items-center gap-3 bg-white/[0.03] px-4 py-3">
												<input
													type="checkbox"
													className="size-4 accent-tarkov-green"
													checked={c.selected.includes(mode)}
													disabled={same}
													onChange={() => c.toggle(mode)}
												/>
												<span className="text-sm font-semibold text-white">{mode}</span>
												<span
													className={`ml-auto flex items-center gap-1.5 text-xs ${same || state === "empty" ? "text-tarkov-green" : "text-amber-200"}`}
												>
													{same ? (
														<>
															<CheckCircle2 size={14} />
															Up to date
														</>
													) : state === "empty" ? (
														"Default profile"
													) : (
														"Replace progress"
													)}
												</span>
											</label>
											<div className="grid grid-cols-3 gap-2 border-t border-white/5 px-4 py-3 text-xs text-gray-400">
												<span>
													Level <b className="text-gray-200">{incoming.progress.playerLevel}</b>
												</span>
												<span>
													<b className="text-gray-200">{Object.keys(incoming.progress.itemCounts).length}</b> item types
												</span>
												<span>
													<b className="text-gray-200">
														{Object.values(incoming.progress.completedQuests).filter(Boolean).length}
													</b>{" "}
													quests done
												</span>
											</div>
											{!same && (
												<details className="border-t border-white/5">
													<summary className="cursor-pointer px-4 py-2.5 text-xs text-[#c7b99b]">
														Compare progress
													</summary>
													<div className="overflow-x-auto px-4 pb-3">
														<table className="w-full text-left text-xs">
															<thead className="text-[10px] uppercase tracking-wider text-gray-500">
																<tr>
																	<th className="py-2 font-medium">Progress</th>
																	<th className="py-2 font-medium">Current</th>
																	<th className="py-2 font-medium">Incoming</th>
																</tr>
															</thead>
															<tbody>
																{rows.map((row) => (
																	<tr
																		key={row.label}
																		className={`border-t border-white/5 ${row.changed ? "text-amber-100" : "text-gray-400"}`}
																	>
																		<td className="max-w-48 py-2 pr-3 align-top">
																			{row.label}
																			{!row.changed && (
																				<span className="block text-[10px] text-gray-500">Unchanged</span>
																			)}
																		</td>
																		{[row.current, row.incoming].map((value, index) => (
																			<td key={index} className="max-w-52 py-2 pr-2 align-top">
																				{summary(value)}
																				{value !== null &&
																					typeof value === "object" &&
																					Object.keys(value).length > 0 && (
																						<details className="mt-1">
																							<summary className="cursor-pointer text-[10px] text-[#c7b99b]">
																								View records / IDs
																							</summary>
																							<pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-black/20 p-2 text-[10px]">
																								{JSON.stringify(value, null, 2)}
																							</pre>
																						</details>
																					)}
																			</td>
																		))}
																	</tr>
																))}
															</tbody>
														</table>
													</div>
												</details>
											)}
										</section>
									);
								})}
								{c.replacing && (
									<label className="flex items-start gap-3 rounded-md border border-amber-300/25 bg-amber-300/5 p-3 text-xs leading-5 text-amber-100">
										<input
											type="checkbox"
											className="mt-1 size-4 shrink-0 accent-tarkov-green"
											checked={c.acknowledged}
											onChange={(event) => c.setAcknowledged(event.target.checked)}
										/>
										Replace selected profiles, including removing progress absent from this backup.
									</label>
								)}
							</>
						)}
					</div>
					<DialogFooter className="grid shrink-0 grid-cols-2 items-center border-t border-white/10 bg-black/15 px-5 py-4 sm:flex">
						<button className={button} onClick={c.close}>
							Cancel
						</button>
						<button
							className={primary}
							onClick={c.submit}
							disabled={!c.backup || !c.selected.length || c.loading || (c.replacing && !c.acknowledged)}
						>
							Confirm import
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
