"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/** Floating chip that appears once the page has scrolled past roughly one viewport. */
export function BackToTopChip() {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const update = () => setVisible(window.scrollY > window.innerHeight);
		update();
		window.addEventListener("scroll", update, { passive: true });
		window.addEventListener("resize", update);
		return () => {
			window.removeEventListener("scroll", update);
			window.removeEventListener("resize", update);
		};
	}, []);

	return (
		<button
			type="button"
			aria-hidden={!visible}
			inert={!visible}
			onClick={() => {
				const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
				window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
			}}
			className={cn(
				"fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-1/2 z-40 flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full border border-highlight/15 bg-[var(--card-bg)]/95 px-3 text-xs font-semibold text-foreground shadow-2xl backdrop-blur-md transition-[opacity,transform] duration-200 ease-out hover:border-highlight/30 focus-visible:outline-2 focus-visible:outline-brand motion-reduce:transition-none",
				visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
			)}
		>
			<ArrowUp size={13} className="text-brand" aria-hidden="true" />
			Top
		</button>
	);
}
