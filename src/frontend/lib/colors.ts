/** Each leave type gets a stable colour from this palette, by its position. CSS tokens --t0..--t5 carry light and dark values. */
export const TYPE_COLORS = 6;
export function typeColorVar(index: number): string {
  return `var(--t${((index % TYPE_COLORS) + TYPE_COLORS) % TYPE_COLORS})`;
}
