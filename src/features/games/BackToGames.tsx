import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function BackToGames({ className }: { className?: string }) {
	return (
		<Link
			href="/games"
			className={cn(
				"inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
				className,
			)}
		>
			<ArrowLeft size={16} />
			Games
		</Link>
	);
}
