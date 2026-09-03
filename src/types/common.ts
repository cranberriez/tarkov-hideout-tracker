export type {
    GameMode,
    TarkovJsonGameMode as TarkovDataMode,
} from "@/lib/game-mode";

export interface EntityReference {
    id: string;
    name: string;
}

export interface NormalizedEntityReference extends EntityReference {
    normalizedName: string;
}

export interface DataDiagnostics {
    provider: "json" | "graphql";
    localePaths?: string[];
    usedRegularLocaleFallback?: boolean;
    upstreamStatus?: "ok" | "stale-fallback";
}

export interface DataResult<T> {
    data: T;
    updatedAt: number;
    diagnostics?: DataDiagnostics;
}
