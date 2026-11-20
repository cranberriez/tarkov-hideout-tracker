/**
 * Lifted control surface: an opaque raised fill, a 1px top light and a near-invisible
 * full ring, so controls read as pressable without leaving the flat style.
 */
export const liftedControl =
	"border border-highlight/[0.025] bg-surface-raised shadow-[inset_0_1px_0_rgb(255_255_255/0.07)] transition-colors hover:border-highlight/[0.06] hover:bg-[color-mix(in_oklab,var(--surface-raised)_92%,var(--highlight))]";
/** Selected state layered on `liftedControl`. */
export const liftedSelected = "text-brand";
/** Lifted form field and its stacked label. */
export const flatField = `h-9 rounded-md px-3 text-sm text-foreground outline-none focus-visible:outline-2 focus-visible:outline-brand ${liftedControl}`;
export const fieldLabel = "grid gap-1.5 text-xs font-medium text-muted-foreground";
/** Calmly dims a displayed value while an enclosing `group/sync` element has `data-syncing="true"`; no pulsing, so repeated recalculations do not flash. */
export const syncValue =
	"transition-opacity duration-300 ease-out group-data-[syncing=true]/sync:opacity-60 motion-reduce:transition-none";
