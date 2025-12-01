"use client";

import type { ReactNode } from "react";

interface RouteLoaderProps {
    children?: ReactNode;
}

export function RouteLoader({ children }: RouteLoaderProps) {
    return (
        <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tarkov-green" />
            {children}
        </div>
    );
}
