export class RequestError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly code: string | null = null,
		public readonly details: unknown = null,
	) {
		super(message);
		this.name = "RequestError";
	}
}

export class PartialDataError<T> extends Error {
	constructor(message: string, public readonly payload: T) {
		super(message);
		this.name = "PartialDataError";
	}
}

export class ResponseValidationError extends Error {
	constructor(message: string, public readonly details: unknown = null) {
		super(message);
		this.name = "ResponseValidationError";
	}
}

function errorMessage(body: unknown, fallback: string): string {
	if (body && typeof body === "object" && "error" in body && typeof body.error === "string") return body.error;
	return fallback;
}

export async function fetchJson<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
	const response = await fetch(input, init);
	let body: unknown = null;
	try {
		body = await response.json();
	} catch {
		if (response.ok) throw new RequestError("The server returned an invalid JSON response", response.status, "invalid_json");
	}
	if (!response.ok) {
		const code = body && typeof body === "object" && "code" in body && typeof body.code === "string" ? body.code : null;
		throw new RequestError(errorMessage(body, `Request failed (${response.status})`), response.status, code, body);
	}
	return body as T;
}

export function requireComplete<T>(payload: T, isComplete: (payload: T) => boolean, message = "Some requested data is unavailable"): T {
	if (!isComplete(payload)) throw new PartialDataError(message, payload);
	return payload;
}

export function shouldRetryRequest(failureCount: number, error: Error): boolean {
	if (error.name === "AbortError") return false;
	if (error instanceof PartialDataError || error instanceof ResponseValidationError) return false;
	if (error instanceof RequestError && error.code === "invalid_json") return false;
	if (error instanceof RequestError && error.status >= 400 && error.status < 500) return false;
	return failureCount < 2;
}
