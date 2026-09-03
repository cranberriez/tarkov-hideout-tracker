export class TursoConfigurationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TursoConfigurationError";
    }
}

export class TursoRecordNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TursoRecordNotFoundError";
    }
}

export class TursoDataIntegrityError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TursoDataIntegrityError";
    }
}
