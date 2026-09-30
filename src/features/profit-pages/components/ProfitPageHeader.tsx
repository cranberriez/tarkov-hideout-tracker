import type { ProfitPageKind } from "../types";
import { PROFIT_KINDS } from "../profit-kinds";

export function ProfitPageHeader({ kind }: { kind: ProfitPageKind }) {
	return (
		<header className="mb-6">
			<h1 className="text-3xl font-bold tracking-tight text-foreground">{PROFIT_KINDS[kind].title}</h1>
		</header>
	);
}
