import { balloonSvg, RED } from './balloon.js';

export { balloonSvg };

/**
 * The logo's one extra beat: three short rays off the balloon's upper right,
 * taken from the app's pop burst, so the mark reads as "about to pop".
 * Drawn over a balloon of the given width, positioned absolutely.
 */
export function sparksSvg(width, color = RED.light) {
  const unit = width / 24;
  const cx = 12 * unit;
  const cy = 11 * unit;
  const rays = [-62, -36, -10].map((deg, i) => {
    const r = (deg * Math.PI) / 180;
    const from = (11.4 + (i === 1 ? 0.5 : 0)) * unit;
    const to = from + (i === 1 ? 3.6 : 2.6) * unit;
    return `<line x1="${cx + Math.cos(r) * from}" y1="${cy + Math.sin(r) * from}" x2="${cx + Math.cos(r) * to}" y2="${cy + Math.sin(r) * to}"
      stroke="${color}" stroke-width="${unit * 0.95}" stroke-linecap="round"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}" style="position:absolute;left:0;top:0;overflow:visible">${rays.join('')}</svg>`;
}
