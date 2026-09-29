/** Joins class names, skipping falsy parts. Later classes don't override earlier ones —
 *  pass overrides that don't conflict with the base recipe (e.g. width/margin). */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
