"use client";

import { Filter, X, type LucideIcon } from "lucide-react";
import { useId } from "react";

export interface ActiveFilter {
	id: string;
	label: string;
	icon?: LucideIcon;
	description?: string;
	removeLabel?: string;
	onRemove: () => void;
}

export function ActiveFilters({ filters }: { filters: ActiveFilter[] }) {
	const descriptionId = useId();
	return (
		<div className="flex flex-wrap items-center gap-2 pr-2" aria-label="Active filters">
			<span role="status" className="text-xs text-muted-foreground">
				{filters.length} active {filters.length === 1 ? "filter" : "filters"}
			</span>
			{filters.map(({ id, label, icon: Icon = Filter, description, removeLabel, onRemove }) => (
				<button
					key={id}
					type="button"
					onClick={onRemove}
					aria-label={removeLabel ?? `Remove ${label} filter`}
					aria-describedby={description ? `${descriptionId}-${id}` : undefined}
					title={description ?? `Remove ${label} filter`}
					className="inline-flex max-w-full items-center gap-1.5 rounded-sm px-2 py-1 text-xs text-muted-foreground hover:bg-highlight/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"
				>
					<Icon size={13} aria-hidden="true" />
					<span className="truncate">{label}</span>
					<X size={12} className="shrink-0" aria-hidden="true" />
					{description && (
						<span id={`${descriptionId}-${id}`} className="sr-only">
							{description}
						</span>
					)}
				</button>
			))}
		</div>
	);
}

export function ClearSearchAndFilters({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="mt-3 rounded-sm px-3 py-2 text-sm text-brand hover:bg-brand/10 focus-visible:outline-2 focus-visible:outline-brand"
		>
			Clear search and filters
		</button>
	);
}
