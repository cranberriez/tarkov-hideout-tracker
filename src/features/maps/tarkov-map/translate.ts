// Port of `src-tauri/src/tarkov_data/split.rs` `translate`, for reading tarkov.dev without the desktop backend.

type Json = unknown;
type Step = { field: string } | "values" | "elements";

/** `$.data.maps.*.extracts[*].name` → steps; `.*` is every object value, `[*]` every array element. */
function parsePath(path: string): Step[] {
  const steps: Step[] = [];
  for (const part of path.replace(/^\$/, "").split(".").filter(Boolean)) {
    const elements = part.endsWith("[*]");
    const field = elements ? part.slice(0, -3) : part;
    steps.push(field === "*" ? "values" : { field });
    if (elements) steps.push("elements");
  }
  return steps;
}

function apply(value: Json, steps: Step[], names: Record<string, Json>, set: (next: Json) => void) {
  const [step, ...rest] = steps;
  if (!step) {
    if (typeof value === "string" && typeof names[value] === "string") set(names[value]);
    return;
  }
  if (step === "elements") {
    if (Array.isArray(value)) value.forEach((child, index) => apply(child, rest, names, (next) => { value[index] = next; }));
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    const object = value as Record<string, Json>;
    if (step === "values") for (const key of Object.keys(object)) apply(object[key], rest, names, (next) => { object[key] = next; });
    else if (step.field in object) apply(object[step.field], rest, names, (next) => { object[step.field] = next; });
  }
}

/**
 * Replaces translation keys with display strings, in place, at the JSON paths a tarkov.dev response lists in
 * `translations`; `names` is the `data` object of the matching `*_en` response.
 */
export function translate(response: { translations?: string[] }, names: Record<string, Json>) {
  for (const path of response.translations ?? []) apply(response, parsePath(path), names, () => {});
}
