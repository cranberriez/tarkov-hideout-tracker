import { cn } from "@/lib/utils";
import { liftedControl, liftedSelected } from "./field";

/** Single-choice control: a recessed track with the selected option lifted out of it. */
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
		<div role="group" aria-label={label} className="inline-flex h-9 gap-0.5 rounded-md bg-background p-0.5">
			{options.map((option) => {
				const selected = option.value === value;
				return (
					<button
						key={option.value}
						type="button"
						aria-pressed={selected}
						onClick={() => onChange(option.value)}
						className={cn(
							"rounded-[5px] px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand",
							selected
								? cn(liftedControl, liftedSelected)
								: "border border-transparent text-foreground/70 transition-colors hover:text-foreground",
						)}
					>
						{option.label}
					</button>
				);
			})}
		</div>
	);
}
