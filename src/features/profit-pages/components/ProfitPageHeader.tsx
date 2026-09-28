import type { ProfitPageKind } from "../types";

export function ProfitPageHeader({ kind }: { kind: ProfitPageKind }) {
	return (
		<header className="mb-6">
			<h1 className="text-3xl font-bold tracking-tight text-foreground">
				{kind === "barter" ? "BARTER PROFITS" : "CRAFTING PROFITS"}
			</h1>
		</header>
	);
}
