import type { ReactNode } from "react";

interface ItemsLayoutProps {
    children: ReactNode;
}

export default function ItemsLayout({ children }: ItemsLayoutProps) {
    return children;
}
