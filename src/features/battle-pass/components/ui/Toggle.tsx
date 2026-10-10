import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Toggle({
	checked,
	onChange,
	icon,
	children,
	title,
}: {
	checked: boolean;
	onChange: (checked: boolean) => void;
	icon?: ReactNode;
	children: ReactNode;
	title?: string;
}) {
	return (
		<label
			title={title}
			className={cn(
				"flex h-8 cursor-pointer items-center gap-2 rounded-md px-2.5 text-xs transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-brand",
				checked ? "bg-brand/15 text-brand" : "bg-surface-raised/50 text-muted-foreground hover:text-foreground",
			)}
		>
			<input
				type="checkbox"
				className="sr-only"
				checked={checked}
				onChange={(event) => onChange(event.target.checked)}
			/>
			{icon}
			{children}
		</label>
	);
}
