import { cn } from "@/lib/utils";

/** Flat single-choice control. Unselected options keep readable foreground text. */
export function Segmented<T extends string>({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: T;
	options: { value: T; label: string }[];
	onChange: (value: T) => void;
}) {
	return (
		<div role="group" aria-label={label} className="inline-flex h-9 rounded-md bg-surface-raised/60 p-0.5">
			{options.map((option) => {
				const selected = option.value === value;
				return (
					<button
						key={option.value}
						type="button"
						aria-pressed={selected}
						onClick={() => onChange(option.value)}
						className={cn(
							"rounded-[5px] px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand",
							selected ? "bg-brand/20 text-brand" : "text-foreground/70 hover:text-foreground",
						)}
					>
						{option.label}
					</button>
				);
			})}
		</div>
	);
}
