import type { ReactNode } from "react";

interface HideoutLayoutProps {
    children: ReactNode;
}

export default function HideoutLayout({ children }: HideoutLayoutProps) {
    return children;
}
