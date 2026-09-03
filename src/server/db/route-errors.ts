import { NextResponse } from "next/server";
import { TursoConfigurationError, TursoRecordNotFoundError } from "./errors";

export function itemDatabaseErrorResponse(error: unknown, unavailableMessage: string) {
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
