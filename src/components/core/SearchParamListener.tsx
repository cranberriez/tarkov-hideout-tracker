"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Reports one query parameter after hydration. Render it inside its own
 * `<Suspense fallback={null}>`: on statically rendered pages `useSearchParams`
 * opts the nearest Suspense boundary out of the prerender, and this keeps that
 * boundary empty instead of the surrounding page content.
 */
export function SearchParamListener({ name, onChange }: { name: string; onChange: (value: string | null) => void }) {
	const value = useSearchParams().get(name);
	useEffect(() => onChange(value), [value, onChange]);
	return null;
}
