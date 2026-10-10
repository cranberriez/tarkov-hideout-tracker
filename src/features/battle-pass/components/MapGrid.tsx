import { documents } from "../lib/battle-pass-model";
import { mapNames, mapOrder, locations } from "../lib/battle-pass-display";
import { DocumentChip } from "./ui/DocumentChip";
import { cn } from "@/lib/utils";

export function MapGrid() {
	return (
		<div className="overflow-x-auto rounded-lg bg-card p-3 sm:p-4">
			<table className="mx-auto w-full min-w-[630px] max-w-5xl table-fixed border-separate border-spacing-1 text-xs">
				<caption className="sr-only">
					Possible document spawns per map: seven per relevant type, five on Factory
				</caption>
				<thead>
					<tr>
						<th scope="col" className="w-36 text-left font-normal text-subtle-foreground">
							Spawns / type
						</th>
						{documents.map((doc, i) => (
							<th scope="col" key={doc.key} className="h-14 pb-1 font-normal">
								<DocumentChip doc={doc} end={i > 3} />
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{mapOrder.map((map) => (
						<tr key={map} className="group">
							<th
								scope="row"
								className="whitespace-nowrap py-1.5 pr-3 text-left font-medium text-muted-foreground group-hover:text-foreground"
							>
								{map}
							</th>
							{documents.map((doc) => {
								const relevant = mapNames[doc.key]?.includes(map);
								const count =
									map === "Factory" ? locations.spawnsPerRelevantType.factory : locations.spawnsPerRelevantType.default;
								return (
									<td
										key={doc.key}
										aria-label={`${map}, ${doc.name}: ${relevant ? count : 0}`}
										className={cn(
											"rounded text-center tabular-nums",
											relevant
												? "bg-brand/15 font-semibold text-brand group-hover:bg-brand/25"
												: "bg-surface-raised/25",
										)}
									>
										<span aria-hidden>{relevant ? count : ""}</span>
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>
			<div className="mt-3 flex justify-between text-[11px] text-subtle-foreground">
				<span>Possible spawns, not guaranteed pickups.</span>
				<a href={locations.corroboratingSourceUrl} target="_blank" rel="noreferrer" className="hover:text-brand">
					Spawn guides ↗
				</a>
			</div>
		</div>
	);
}
