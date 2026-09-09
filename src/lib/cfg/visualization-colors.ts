/**
 * Shared colors for diagrams and map markers.
 *
 * Keep these as CSS custom-property references so visualizations follow the
 * active theme while retaining a stable, distinct sequence in each view.
 */
export const VISUALIZATION_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
] as const;

export function getVisualizationColor(index: number) {
    return VISUALIZATION_COLORS[Math.abs(index) % VISUALIZATION_COLORS.length];
}
