import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Toggle({
	checked,
	onChange,
	icon,
	children,
	title,
	className,
	indicator = false,
	disabled = false,
}: {
	checked: boolean;
	onChange: (checked: boolean) => void;
	icon?: ReactNode;
	children: ReactNode;
	title?: string;
	className?: string;
	/** Show a check box so state reads without relying on tint alone. */
	indicator?: boolean;
	disabled?: boolean;
}) {
	return (
		<label
			title={title}
			className={cn(
				"flex h-8 cursor-pointer items-center gap-2 rounded-md px-2.5 text-xs transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-brand",
				checked
					? "bg-brand/15 text-brand"
					: indicator
						? "bg-surface-raised/60 text-foreground/75 hover:text-foreground"
						: "bg-surface-raised/50 text-muted-foreground hover:text-foreground",
				disabled && "pointer-events-none opacity-40",
				className,
			)}
		>
			<input
				type="checkbox"
				className="sr-only"
				checked={checked}
				disabled={disabled}
				onChange={(event) => onChange(event.target.checked)}
			/>
			{indicator && (
				<span
					aria-hidden
					className={cn(
						"flex size-3.5 shrink-0 items-center justify-center rounded-[3px]",
						checked ? "bg-brand text-inverse" : "bg-highlight/15",
					)}
				>
					{checked && <Check className="size-3" strokeWidth={3} />}
				</span>
			)}
			{icon}
			{children}
		</label>
	);
}
