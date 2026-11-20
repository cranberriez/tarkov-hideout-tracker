import { FileText } from "lucide-react";
import { useBattlePassData } from "../../BattlePassSeason";
import { Artwork } from "./Artwork";

export function DocumentIcon({ documentKey, className = "size-6" }: { documentKey?: string; className?: string }) {
	const { documents } = useBattlePassData();
	const document = documents.find((entry) => entry.key === documentKey);
	return document?.img ? (
		<Artwork src={document.img} className={className} />
	) : (
		<FileText className={className} aria-hidden />
	);
}
