/** Dynamic segment values may arrive encoded; malformed escapes are kept verbatim. */
export function decodeRouteParam(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}
