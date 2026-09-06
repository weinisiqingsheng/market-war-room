/** Tiny class-name joiner — keeps common UI primitives dependency-free. */
export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
