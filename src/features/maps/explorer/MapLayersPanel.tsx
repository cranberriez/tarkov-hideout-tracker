"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
	allFloorsOn,
	groupOn,
	layerState,
	sameFilters,
	tarkovPreset,
	toggleLayer,
	useMapAssets,
	type Filters,
	type LayerDef,
	type LayerFilter,
	type MarkerPreset,
} from "../tarkov-map";
import { AllFloorsIcon, CaretIcon, PinIcon, ResetIcon } from "./icons";
import { PRESET_SLOTS } from "./useMapExplorerPreferences";

/**
 * Tiered marker filter (ported from tarkov-mappinator): each layer row switches the whole layer, the rows under it
 * switch its groups; the floors button beside a layer keeps its markers visible on other floors. Groups the map has
 * no markers for are left out. Layers fold behind a caret; three slots save and restore the switches (right click a
 * saved slot to overwrite or clear it).
 */
export function MapLayersPanel({
	layers,
	filters,
	defaults,
	counts,
	open,
	onOpen,
	onChange,
	collapsed,
	onCollapse,
	presets: stored,
	onPresets,
	preset: markerPreset = tarkovPreset,
}: {
	layers: LayerDef[];
	filters: Filters;
	defaults: Filters;
	counts: Record<string, number>;
	open: boolean;
	onOpen: (open: boolean) => void;
	onChange: (filters: Filters) => void;
	collapsed: Record<string, boolean>;
	onCollapse: (collapsed: Record<string, boolean>) => void;
	presets: (Filters | null)[];
	onPresets: (presets: (Filters | null)[]) => void;
	preset?: MarkerPreset;
}) {
	const { icon: iconSrc, link: assetUrl } = useMapAssets();
	const [menu, setMenu] = useState<{ slot: number; x: number; y: number } | null>(null);
	const presets = Array.from({ length: PRESET_SLOTS }, (_, index) => stored[index] ?? null);
	const setCollapsed = (update: (current: Record<string, boolean>) => Record<string, boolean>) =>
		onCollapse(update(collapsed));
	const setPreset = (slot: number, value: Filters | null) =>
		onPresets(presets.map((preset, index) => (index === slot ? value : preset)));

	const shown = layers.filter((layer) => counts[layer.key]);
	const setGroup = (key: string, group: string, on: boolean) =>
		onChange({ ...filters, [key]: { ...filters[key], groups: { ...filters[key].groups, [group]: on } } });

	const groupRow = (layerKey: string, state: LayerFilter, group: LayerDef["groups"][number], sub: boolean) => {
		const on = groupOn(state, group.key, layerKey, markerPreset);
		return (
			<button
				key={group.key}
				type="button"
				className={`layer-row group ${sub ? "sub" : ""} ${on ? "" : "off"}`}
				aria-pressed={on}
				title={group.label}
				onClick={() => setGroup(layerKey, group.key, !on)}
			>
				{group.image ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={assetUrl(group.image)}
						alt=""
						className="portrait"
						draggable={false}
						onError={(event) => {
							event.currentTarget.onerror = null;
							event.currentTarget.src = iconSrc(group.icon) ?? "";
							event.currentTarget.className = "";
						}}
					/>
				) : (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={iconSrc(group.icon)}
						alt=""
						className={group.tint ? "tinted" : undefined}
						style={group.tint ? ({ "--tint": group.tint } as CSSProperties) : undefined}
					/>
				)}
				<span className="group-name">{group.label}</span>
				<span className="faint">{counts[`${layerKey}.${group.key}`]}</span>
			</button>
		);
	};

	return (
		<div className={`map-layers ${open ? "open" : ""}`}>
			<div className="layers-bar">
				<button
					type="button"
					className={`icon-button ${open ? "active" : ""}`}
					aria-expanded={open}
					title={open ? "Hide map layers" : "Map layers"}
					onClick={() => onOpen(!open)}
				>
					<PinIcon />
				</button>
				{open && (
					<>
						<div className="presets">
							{presets.map((preset, slot) => {
								const active = !!preset && sameFilters(preset, filters, markerPreset);
								return (
									<button
										key={slot}
										type="button"
										className={`preset ${preset ? "saved" : ""} ${active ? "active" : ""}`}
										title={preset ? `Preset ${slot + 1} · right click for options` : `Save as preset ${slot + 1}`}
										onClick={() =>
											preset ? onChange(structuredClone(preset)) : setPreset(slot, structuredClone(filters))
										}
										onContextMenu={(event) => {
											event.preventDefault();
											if (preset) setMenu({ slot, x: event.clientX, y: event.clientY });
										}}
									>
										{slot + 1}
									</button>
								);
							})}
						</div>
						<button
							type="button"
							className="icon-button"
							title="Reset to defaults"
							disabled={sameFilters(filters, defaults, markerPreset)}
							onClick={() => onChange(structuredClone(defaults))}
						>
							<ResetIcon />
						</button>
					</>
				)}
			</div>
			{open && (
				<div className="layers-list">
					{shown.length ? (
						shown.map((layer) => {
							const state = filters[layer.key];
							const folded = collapsed[layer.key] ?? !!layer.folded;
							// The header speaks for the groups this map has.
							const present = layer.groups.filter((group) => counts[`${layer.key}.${group.key}`]);
							const status = layerState(
								state,
								present.map((group) => group.key),
								layer.key,
								markerPreset,
							);
							const floorsOn = allFloorsOn(state, layer.key, markerPreset);
							return (
								<div key={layer.key} className={`layer ${status}`}>
									<div className="layer-head">
										<button
											type="button"
											className={`caret ${folded ? "folded" : ""}`}
											aria-expanded={!folded}
											title={folded ? `Expand ${layer.label}` : `Collapse ${layer.label}`}
											onClick={() => setCollapsed((current) => ({ ...current, [layer.key]: !folded }))}
										>
											<CaretIcon />
										</button>
										<button
											type="button"
											className="layer-row"
											aria-pressed={status === "mixed" ? "mixed" : status === "on"}
											aria-label={layer.label}
											title={
												status === "off"
													? `Show all ${layer.label.toLowerCase()}`
													: `Hide all ${layer.label.toLowerCase()}`
											}
											onClick={() =>
												onChange({
													...filters,
													[layer.key]: toggleLayer(
														state,
														present.map((group) => group.key),
														layer.key,
														markerPreset,
													),
												})
											}
										>
											<span className="layer-name">{layer.label}</span>
											<span className="faint">{counts[layer.key]}</span>
										</button>
										<button
											type="button"
											className={`layer-floors ${floorsOn ? "on" : ""}`}
											aria-pressed={floorsOn}
											title={floorsOn ? "Only on the shown floor" : "Show on all floors"}
											onClick={() => onChange({ ...filters, [layer.key]: { ...state, allFloors: !floorsOn } })}
										>
											<AllFloorsIcon />
										</button>
									</div>
									{!folded && (
										<div className="layer-groups">
											{layer.categories
												? layer.categories.map((category) => {
														const types = present.filter((group) => group.parent === category.key);
														if (types.length <= 1)
															return types.map((group) => groupRow(layer.key, state, group, false));
														// A category folds its types; its row switches them all, like the layer header does.
														const id = `${layer.key}.${category.key}`;
														const unfolded = collapsed[id] === false;
														const keys = types.map((group) => group.key);
														const catState = layerState(state, keys, layer.key, markerPreset);
														return (
															<div key={category.key} className="layer-cat">
																<div className={`layer-head cat ${catState}`}>
																	<button
																		type="button"
																		className={`caret ${unfolded ? "" : "folded"}`}
																		aria-expanded={unfolded}
																		title={unfolded ? `Collapse ${category.label}` : `Expand ${category.label}`}
																		onClick={() => setCollapsed((current) => ({ ...current, [id]: unfolded }))}
																	>
																		<CaretIcon />
																	</button>
																	<button
																		type="button"
																		className="layer-row group"
																		aria-pressed={catState === "mixed" ? "mixed" : catState === "on"}
																		aria-label={category.label}
																		title={
																			catState === "off"
																				? `Show all ${category.label.toLowerCase()}`
																				: `Hide all ${category.label.toLowerCase()}`
																		}
																		onClick={() =>
																			onChange({
																				...filters,
																				[layer.key]: toggleLayer(state, keys, layer.key, markerPreset),
																			})
																		}
																	>
																		{/* eslint-disable-next-line @next/next/no-img-element */}
																		<img src={iconSrc(category.icon)} alt="" />
																		<span className="group-name">{category.label}</span>
																		<span className="faint">
																			{types.reduce(
																				(sum, group) => sum + (counts[`${layer.key}.${group.key}`] ?? 0),
																				0,
																			)}
																		</span>
																	</button>
																</div>
																<div className={`layer-types ${unfolded ? "" : "folded"}`}>
																	{types.map((group) => groupRow(layer.key, state, group, true))}
																</div>
															</div>
														);
													})
												: present.map((group) => groupRow(layer.key, state, group, false))}
										</div>
									)}
								</div>
							);
						})
					) : (
						<p className="layer-empty faint">No map data</p>
					)}
				</div>
			)}
			{menu && (
				<PresetMenu
					{...menu}
					onClose={() => setMenu(null)}
					onOverwrite={() => setPreset(menu.slot, structuredClone(filters))}
					onClear={() => setPreset(menu.slot, null)}
				/>
			)}
		</div>
	);
}

function PresetMenu({
	slot,
	x,
	y,
	onClose,
	onOverwrite,
	onClear,
}: {
	slot: number;
	x: number;
	y: number;
	onClose: () => void;
	onOverwrite: () => void;
	onClear: () => void;
}) {
	useEffect(() => {
		const close = () => onClose();
		const escape = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		// Deferred so the opening right click doesn't close it straight away.
		const timer = setTimeout(() => {
			window.addEventListener("pointerdown", close);
			window.addEventListener("contextmenu", close);
			window.addEventListener("blur", close);
		});
		window.addEventListener("keydown", escape);
		return () => {
			clearTimeout(timer);
			window.removeEventListener("pointerdown", close);
			window.removeEventListener("contextmenu", close);
			window.removeEventListener("blur", close);
			window.removeEventListener("keydown", escape);
		};
	}, [onClose]);
	const act = (action: () => void) => () => {
		action();
		onClose();
	};
	// Portalled: the panel's backdrop filter would otherwise anchor `position: fixed` to the panel.
	return createPortal(
		<div
			className="map-explorer-menu context-menu"
			role="menu"
			style={{ left: x, top: y }}
			onPointerDown={(event) => event.stopPropagation()}
		>
			<span className="context-title">Preset {slot + 1}</span>
			<button type="button" role="menuitem" onClick={act(onOverwrite)}>
				Overwrite preset
			</button>
			<button type="button" role="menuitem" className="danger" onClick={act(onClear)}>
				Clear preset
			</button>
		</div>,
		document.body,
	);
}
