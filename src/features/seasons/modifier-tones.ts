/**
 * Personal modifier card backgrounds, shared by the season page and the screenshot sheet.
 * The 12% tint keeps foreground text at WCAG AAA in every theme; the hue's chroma is cut by 40%
 * (relative oklch color) so the tint reads muted rather than neon.
 */
export const MODIFIER_CARD_TINT = {
	positive: "bg-linear-to-r from-[oklch(from_var(--success)_l_calc(c*0.6)_h/0.12)] to-card to-70%",
	negative: "bg-linear-to-r from-[oklch(from_var(--danger)_l_calc(c*0.6)_h/0.12)] to-card to-70%",
} as const;
