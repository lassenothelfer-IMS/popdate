// The Popdate balloon, drawn from the same 24 x 34 paths as mobile/src/components/balloon.tsx,
// with a soft gradient so it reads as a real balloon at poster size.
export const BODY =
  'M12 1.5C6.2 1.5 2.5 6 2.5 11.6c0 6.4 5 11.4 8.4 12.3h2.2c3.4-.9 8.4-5.9 8.4-12.3C21.5 6 17.8 1.5 12 1.5z';
export const KNOT = 'M10.4 23.6h3.2l-1.6 2.4z';

export const RED = { light: '#F27A6E', base: '#E2483B', deep: '#A92A21' };

/** A string that hangs from the knot and sways with `phase` (radians). */
export function stringPath(phase, sway = 1, length = 8) {
  const a = Math.sin(phase) * 1.6 * sway;
  const b = Math.sin(phase + 1.3) * 1.4 * sway;
  return `M12 26C${12 + a} ${26 + length * 0.35} ${12 - b} ${26 + length * 0.65} ${12 + a * 0.6} ${26 + length}`;
}

/** The balloon as an SVG string. `id` keeps gradient ids unique when several are on one page. */
export function balloonSvg({ id = 'b', width = 300, string = true, phase = 0, stringColor = '#F3EEE7' } = {}) {
  const length = 14;
  const vbHeight = string ? 26 + length + 1 : 27;
  const height = (width * vbHeight) / 24;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 24 ${vbHeight}" overflow="visible">
  <defs>
    <radialGradient id="${id}-body" cx="0.36" cy="0.3" r="0.78">
      <stop offset="0" stop-color="${RED.light}"/>
      <stop offset="0.55" stop-color="${RED.base}"/>
      <stop offset="1" stop-color="${RED.deep}"/>
    </radialGradient>
    <radialGradient id="${id}-rim" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0.75" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.22"/>
    </radialGradient>
  </defs>
  ${string ? `<path class="string" d="${stringPath(phase, 1, length)}" fill="none" stroke="${stringColor}" stroke-opacity="0.55" stroke-width="0.32" stroke-linecap="round"/>` : ''}
  <path d="${KNOT}" fill="${RED.deep}"/>
  <path d="${BODY}" fill="url(#${id}-body)"/>
  <path d="${BODY}" fill="url(#${id}-rim)"/>
  <ellipse cx="8.2" cy="7.6" rx="1.7" ry="3.1" fill="#FFFDFA" fill-opacity="0.42" transform="rotate(-22 8.2 7.6)"/>
  <ellipse cx="9.6" cy="4.3" rx="0.55" ry="0.7" fill="#FFFDFA" fill-opacity="0.55"/>
</svg>`;
}
