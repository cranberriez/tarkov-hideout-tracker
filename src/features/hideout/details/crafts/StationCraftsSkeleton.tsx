/** Suspense fallback while station crafts stream in; sits at the bottom so removal causes no shift above. */
export function StationCraftsSkeleton() {
	return (
		<section aria-busy="true" aria-label="Loading crafts">
			<div className="mb-3 h-3 w-16 animate-pulse rounded bg-highlight/10" />
			<div className="flex flex-col gap-2">
				{[0, 1, 2].map((row) => (
					<div key={row} className="h-10 animate-pulse rounded bg-highlight/5" />
				))}
			</div>
		</section>
	);
}
