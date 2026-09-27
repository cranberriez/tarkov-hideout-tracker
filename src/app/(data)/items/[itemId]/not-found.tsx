import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";

export default function ItemNotFound() {
	return (
		<main className="container mx-auto flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
			<h1 className="text-lg font-semibold text-foreground">Item not found</h1>
			<p className="mt-2 max-w-sm text-sm text-muted-foreground">
				This item is not part of the current game mode&apos;s item catalog.
			</p>
			<Link href="/items" className={buttonClassName({ className: "mt-5" })}>Back to items</Link>
		</main>
	);
}
