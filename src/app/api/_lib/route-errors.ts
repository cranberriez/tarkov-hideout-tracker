import { NextResponse } from "next/server";
import { TursoConfigurationError, TursoRecordNotFoundError, TursoTransientReadError } from "@/server/db/errors";
import { CacheControl } from "@/app/api/_lib/cache-control";

export function itemDatabaseErrorResponse(error: unknown, unavailableMessage: string) {
    if (error instanceof TursoTransientReadError) {
        return NextResponse.json(
            { error: error.message },
            { status: 503, headers: { "Cache-Control": CacheControl.privateNoStore } },
        );
    }
    if (error instanceof TursoRecordNotFoundError) {
        return NextResponse.json(
            { error: "Item data was not found" },
            { status: 404, headers: { "Cache-Control": CacheControl.privateNoStore } },
        );
    }

    console.error(unavailableMessage, error);
    return NextResponse.json(
        { error: unavailableMessage },
        {
            status: error instanceof TursoConfigurationError ? 503 : 502,
            headers: { "Cache-Control": CacheControl.privateNoStore },
        },
    );
}
