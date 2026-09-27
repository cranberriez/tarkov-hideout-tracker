export class DatabaseConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DatabaseConfigurationError";
	}
}

export class DatabaseRecordNotFoundError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DatabaseRecordNotFoundError";
	}
}

export class DatabaseDataIntegrityError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DatabaseDataIntegrityError";
	}
}

export class DatabaseTransientReadError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DatabaseTransientReadError";
	}
}
