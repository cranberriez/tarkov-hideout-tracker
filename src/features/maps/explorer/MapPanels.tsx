"use client";

import Link from "next/link";
import { useState } from "react";
import { MAP_EXPLORER_MAPS } from "@/lib/cfg/map-explorer";
import { CaretIcon } from "./icons";

export type FloorOption = { key: string; label: string };

/**
 * Floor picker above the map toolbar. Open: one row per floor; clicking a floor shows only it, clicking it again
 * goes back to all floors. Closed: just the floor being shown, which opens the picker when clicked.
 */
export function MapFloorPanel({
	floors,
	current,
	open,
	onOpen,
	onSelect,
}: {
	floors: FloorOption[];
	/** Floor key being shown, or null for all floors. */
	current: string | null;
	open: boolean;
	onOpen: (open: boolean) => void;
	onSelect: (key: string | null) => void;
}) {
	const label = floors.find((floor) => floor.key === current)?.label ?? "All floors";
	if (!open) {
		return (
			<button type="button" className="map-floor-chip" title="Choose floor" onClick={() => onOpen(true)}>
				{label}
			</button>
		);
	}
	return (
		<div className="map-floors" role="listbox" aria-label="Floors">
			{floors.map((floor) => {
				const selected = floor.key === current;
				return (
					<button
						key={floor.key}
						type="button"
						role="option"
						aria-selected={selected}
						className={`floor-row ${selected ? "active" : ""}`}
						title={selected ? "Show all floors" : `Show only ${floor.label}`}
						onClick={() => onSelect(selected ? null : floor.key)}
					>
						{floor.label}
					</button>
				);
			})}
		</div>
	);
}

/** Top-right pill naming the map and floor shown, with a list of the other maps to switch to. */
export function MapSwitcher({ current, label, floor }: { current: string; label: string; floor?: string }) {
	const [open, setOpen] = useState(false);
	return (
		<div className={`map-switch ${open ? "open" : ""}`}>
			<div className="map-chip">
				<button
					type="button"
					className="map-chip-part"
					aria-expanded={open}
					title={open ? "Hide maps" : "Browse maps"}
					onClick={() => setOpen(!open)}
				>
					{label}
					{floor && <span className="faint">{floor}</span>}
					<span className="map-caret">
						<CaretIcon />
					</span>
				</button>
			</div>
			{open && (
				<nav className="map-switch-list" aria-label="Maps">
					{MAP_EXPLORER_MAPS.map((map) => (
						<Link
							key={map.key}
							href={`/maps/${map.key}`}
							aria-current={map.key === current ? "page" : undefined}
							className={`floor-row ${map.key === current ? "active" : ""}`}
							onClick={() => setOpen(false)}
						>
							{map.name}
						</Link>
					))}
				</nav>
			)}
		</div>
	);
}
