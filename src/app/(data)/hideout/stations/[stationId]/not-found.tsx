import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";

export default function StationNotFound() {
	return (
		<main className="container mx-auto flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
			<h1 className="text-lg font-semibold text-foreground">Station not found</h1>
			<p className="mt-2 max-w-sm text-sm text-muted-foreground">
				This station is not part of the current game mode&apos;s hideout data.
			</p>
			<Link href="/hideout" className={buttonClassName({ className: "mt-5" })}>
				Back to hideout
			</Link>
		</main>
	);
}
