import type { ReactNode } from "react";

/** Text-separated section inside the station page's main panel: no border, readable heading. */
export function WikiSection({
	title,
	description,
	actions,
	children,
	bodyClassName,
}: {
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	children: ReactNode;
	bodyClassName?: string;
}) {
	return (
		<section>
			<div className="mb-4 flex items-start justify-between gap-3">
				<div className="min-w-0">
					<h2 className="text-base font-semibold leading-tight text-foreground">{title}</h2>
					{description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
				</div>
				{actions && <div className="shrink-0">{actions}</div>}
			</div>
			<div className={bodyClassName}>{children}</div>
		</section>
	);
}
