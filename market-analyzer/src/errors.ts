const MAX_PART_LENGTH = 160;

function part(error: unknown): string {
	if (!(error instanceof Error)) return String(error);
	// Drizzle prefixes the full SQL text; the first line is enough to identify the query.
	let message = error.message.split("\n")[0];
	if (message.length > MAX_PART_LENGTH) message = `${message.slice(0, MAX_PART_LENGTH)}…`;
	// Connecting to several addresses (IPv6 and IPv4 localhost) fails as an
	// AggregateError whose own message is empty; its attempts carry the detail.
	if (!message && error instanceof AggregateError)
		message = [...new Set(error.errors.map((inner) => (inner instanceof Error ? inner.message : String(inner))))].join(
			"; ",
		);
	const code = (error as { code?: unknown }).code;
	return typeof code === "string" && !message.includes(code) ? `${message} [${code}]` : message;
}

/**
 * One-line description including the `cause` chain. Database wrappers (Drizzle's
 * "Failed query") keep the actual driver error, e.g. ECONNREFUSED, in `cause`.
 */
export function describeError(error: unknown): string {
	const parts: string[] = [];
	const seen = new Set<unknown>();
	let current: unknown = error;
	while (current !== undefined && current !== null && !seen.has(current) && parts.length < 5) {
		seen.add(current);
		parts.push(part(current));
		current = current instanceof Error ? current.cause : undefined;
	}
	return parts.join(" <- caused by: ");
}

/** Host and database name only; never credentials. */
export function describeDatabaseTarget(connectionString: string | undefined): string {
	if (!connectionString?.trim()) return "(DATABASE_URL is not set)";
	try {
		const url = new URL(connectionString);
		return `${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
	} catch {
		return "(DATABASE_URL is not a valid URL)";
	}
}

/** A container's localhost is the container itself, not the machine running Docker. */
export function databaseHint(connectionString: string | undefined, inContainer: boolean): string | undefined {
	if (!inContainer || !connectionString) return undefined;
	try {
		const host = new URL(connectionString).hostname;
		if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]")
			return "DATABASE_URL points at localhost, which inside the container is the container itself. Use host.docker.internal (mapped in compose.yml) or the database's real host.";
	} catch {
		return undefined;
	}
	return undefined;
}
