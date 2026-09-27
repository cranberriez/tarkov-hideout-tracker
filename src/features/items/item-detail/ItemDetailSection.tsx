import type { ReactNode } from "react";
import { DetailSection } from "@/components/ui/detail-section";

interface ItemDetailSectionProps {
	title: string;
	description?: string;
	aside?: ReactNode;
	children: ReactNode;
	className?: string;
}

export function ItemDetailSection({ title, description, aside, children, className }: ItemDetailSectionProps) {
	return (
		<DetailSection title={title} description={description} actions={aside} className={className}>
			{children}
		</DetailSection>
	);
}
