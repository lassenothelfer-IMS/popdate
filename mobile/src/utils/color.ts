function channels(hex: string) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
}

/** A #RRGGBB color at `alpha` (0-1) opacity, for washes and rings derived from a theme token. */
export function withAlpha(hex: string, alpha: number) {
  const [r, g, b] = channels(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Mixes `amount` (0-1) of `color` into `base`, both #RRGGBB. */
export function mix(base: string, color: string, amount: number) {
  const a = channels(base);
  const b = channels(color);
  const out = a.map((v, i) => Math.round(v + (b[i] - v) * amount));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
