import { NextResponse } from "next/server";
import { TursoConfigurationError, TursoRecordNotFoundError, TursoTransientReadError } from "./errors";

export function itemDatabaseErrorResponse(error: unknown, unavailableMessage: string) {
    if (error instanceof TursoTransientReadError) {
        return NextResponse.json(
            { error: error.message },
            { status: 503, headers: { "Cache-Control": "private, no-store" } },
        );
    }
    if (error instanceof TursoRecordNotFoundError) {
        return NextResponse.json(
            { error: "Item data was not found" },
            { status: 404, headers: { "Cache-Control": "private, no-store" } },
        );
    }

    console.error(unavailableMessage, error);
    return NextResponse.json(
        { error: unavailableMessage },
        {
            status: error instanceof TursoConfigurationError ? 503 : 502,
            headers: { "Cache-Control": "private, no-store" },
        },
    );
}
