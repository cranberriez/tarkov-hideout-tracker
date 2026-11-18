/** Flat, borderless form field and its stacked label. */
export const flatField =
	"h-9 rounded-md bg-surface-raised/60 px-3 text-sm text-foreground outline-none transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-brand";
export const fieldLabel = "grid gap-1.5 text-xs font-medium text-muted-foreground";
/** Pulses a displayed value while an enclosing `group/sync` element has `data-syncing="true"`. */
export const syncValue =
	"transition-opacity group-data-[syncing=true]/sync:animate-pulse group-data-[syncing=true]/sync:opacity-50";
