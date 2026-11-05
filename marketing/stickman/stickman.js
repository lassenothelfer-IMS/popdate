// A rigged stickman for canvas. A pose is a set of joint angles; `solve` turns it into joint
// positions and `drawStickman` paints the silhouette, its face and props.
//
// Angles are in degrees in the character's own frame: 0 points down, 90 points the way the
// character faces, 180 points up, negative angles point backwards. `face` is 1 (facing right)
// or -1 (facing left); values in between turn the character around.

const D2R = Math.PI / 180;
export const LEN = { torso: 92, neck: 9, head: 30, upper: 52, fore: 50, thigh: 64, shin: 62 };
export const EYE = '#F3EEE7';
// How far apart the shoulders and hips sit for a muscular build, before scaling.
export const MUSCLE = { shoulders: 30, hips: 10 };

const dir = (angle, face) => [Math.sin(angle * D2R) * face, Math.cos(angle * D2R)];
const add = (p, d, l) => [p[0] + d[0] * l, p[1] + d[1] * l];
const lerp = (a, b, p) => [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p];

export const POSES = {
  stand: { lean: 0, tilt: 0, aF: 8, eF: 10, aB: -8, eB: 12, tF: 7, kF: -3, tB: -7, kB: -2 },
};

/** Every key from both poses, mixed by `p`. Missing keys count as 0. */
export function blend(a, b, p) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * p;
  return out;
}

/**
 * Joint positions for `pose`, standing with its lower foot on (x, groundY).
 * Pass `hip` to hang the body from a fixed hip point instead (for the balloon lift),
 * and `muscle` to spread the shoulders and hips for a broad build.
 */
export function solve(pose, { x, y, s = 1, face = 1, hip = null, muscle = false }) {
  const L = {};
  for (const [k, v] of Object.entries(LEN)) L[k] = v * s;
  const leg = (t, k) => {
    const knee = dir(t, face), shin = dir(t + k, face);
    return { knee: [knee[0] * L.thigh, knee[1] * L.thigh], foot: [knee[0] * L.thigh + shin[0] * L.shin, knee[1] * L.thigh + shin[1] * L.shin] };
  };
  const lf = leg(pose.tF, pose.kF), lb = leg(pose.tB, pose.kB);
  const h = hip ?? [x + (pose.x ?? 0) * s, y - Math.max(lf.foot[1], lb.foot[1]) + (pose.y ?? 0) * s];
  const up = dir(180 - pose.lean, face);
  // Across the body, pointing to the side the character faces.
  const across = [-up[1] * face, up[0] * face];
  const neck = add(h, up, L.torso);
  const shoulder = add(h, up, L.torso * 0.9);
  const sw = muscle ? MUSCLE.shoulders * s : 0, hw = muscle ? MUSCLE.hips * s : 0;
  const shoulderF = add(shoulder, across, sw), shoulderB = add(shoulder, across, -sw);
  const hipF = add(h, across, hw), hipB = add(h, across, -hw);
  const headAngle = 180 - pose.lean - pose.tilt;
  const head = add(neck, dir(headAngle, face), L.neck + L.head);
  const arm = (root, a, e) => {
    const elbow = add(root, dir(a, face), L.upper);
    return { elbow, hand: add(elbow, dir(a + e, face), L.fore) };
  };
  const af = arm(shoulderF, pose.aF, pose.eF), ab = arm(shoulderB, pose.aB, pose.eB);
  return {
    pose, s, face, r: L.head, headAngle, up, across, muscle, hip: h, neck, shoulder, head,
    shoulderF, shoulderB, hipF, hipB,
    elbowF: af.elbow, handF: af.hand, elbowB: ab.elbow, handB: ab.hand,
    kneeF: [hipF[0] + lf.knee[0], hipF[1] + lf.knee[1]], footF: [hipF[0] + lf.foot[0], hipF[1] + lf.foot[1]],
    kneeB: [hipB[0] + lb.knee[0], hipB[1] + lb.knee[1]], footB: [hipB[0] + lb.foot[0], hipB[1] + lb.foot[1]],
  };
}

function line(ctx, points, width) {
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const p of points.slice(1)) ctx.lineTo(...p);
  ctx.stroke();
}

function dot(ctx, [x, y], r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * A limb segment from `a` to `b` as a muscle: `w1` wide at the start, `w2` at the end, swelling
 * to `front` on one side and `back` on the other around `at` (0..1 along the bone).
 */
function muscle(ctx, a, b, w1, front, back, w2, at = 0.45) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const m = [a[0] + dx * at, a[1] + dy * at];
  ctx.beginPath();
  ctx.moveTo(a[0] + (nx * w1) / 2, a[1] + (ny * w1) / 2);
  ctx.quadraticCurveTo(m[0] + nx * front * 0.62, m[1] + ny * front * 0.62, b[0] + (nx * w2) / 2, b[1] + (ny * w2) / 2);
  ctx.lineTo(b[0] - (nx * w2) / 2, b[1] - (ny * w2) / 2);
  ctx.quadraticCurveTo(m[0] - nx * back * 0.62, m[1] - ny * back * 0.62, a[0] - (nx * w1) / 2, a[1] - (ny * w1) / 2);
  ctx.closePath();
  ctx.fill();
  dot(ctx, a, w1 / 2);
  dot(ctx, b, w2 / 2);
}

function drawSlim(ctx, j, props) {
  const { s } = j;
  line(ctx, [j.hipB, j.kneeB, j.footB], 19 * s);
  line(ctx, [j.shoulderB, j.elbowB, j.handB], 17 * s);
  line(ctx, [j.hip, j.neck], 22 * s);
  if (props.dress) {
    const top = lerp(j.hip, j.neck, 0.55);
    ctx.beginPath();
    ctx.moveTo(top[0] - 9 * s, top[1]);
    ctx.lineTo(top[0] + 9 * s, top[1]);
    ctx.lineTo(j.hip[0] + 34 * s, j.hip[1] + 46 * s);
    ctx.lineTo(j.hip[0] - 34 * s, j.hip[1] + 46 * s);
    ctx.closePath();
    ctx.fill();
  }
  line(ctx, [j.hipF, j.kneeF, j.footF], 19 * s);
  line(ctx, [j.shoulderF, j.elbowF, j.handF], 17 * s);
}

/** A bodybuilder: V-shaped torso, traps, delts, biceps, forearms, quads and calves. */
function drawMuscle(ctx, j) {
  const { s, up, across } = j;
  const side = (p, d) => add(p, across, d);
  // The back leg and arm sit behind the torso.
  muscle(ctx, j.hipB, j.kneeB, 30 * s, 40 * s, 30 * s, 19 * s);
  muscle(ctx, j.kneeB, j.footB, 19 * s, 20 * s, 30 * s, 11 * s, 0.3);
  dot(ctx, j.shoulderB, 17 * s);
  muscle(ctx, j.shoulderB, j.elbowB, 24 * s, 36 * s, 26 * s, 17 * s);
  muscle(ctx, j.elbowB, j.handB, 18 * s, 25 * s, 18 * s, 11 * s, 0.3);
  dot(ctx, j.handB, 10 * s);

  // Torso: wide lats and chest tapering to a narrow waist, traps rising to the neck.
  const top = add(j.hip, up, LEN.torso * 0.92 * s);
  const sw = (MUSCLE.shoulders + 8) * s, ww = 18 * s;
  const chest = add(j.hip, up, LEN.torso * 0.62 * s);
  ctx.beginPath();
  ctx.moveTo(...side(top, sw));
  ctx.quadraticCurveTo(...side(chest, sw * 1.16), ...side(j.hip, ww));
  ctx.lineTo(...side(j.hip, -ww));
  ctx.quadraticCurveTo(...side(chest, -sw * 1.16), ...side(top, -sw));
  ctx.quadraticCurveTo(...add(top, up, 22 * s), ...side(top, sw));
  ctx.closePath();
  ctx.fill();
  dot(ctx, j.hip, 19 * s);
  line(ctx, [top, j.neck], 26 * s);

  muscle(ctx, j.hipF, j.kneeF, 30 * s, 40 * s, 30 * s, 19 * s);
  muscle(ctx, j.kneeF, j.footF, 19 * s, 20 * s, 30 * s, 11 * s, 0.3);
  dot(ctx, j.shoulderF, 17 * s);
  muscle(ctx, j.shoulderF, j.elbowF, 24 * s, 36 * s, 26 * s, 17 * s);
  muscle(ctx, j.elbowF, j.handF, 18 * s, 25 * s, 18 * s, 11 * s, 0.3);
  dot(ctx, j.handF, 10 * s);
}

/**
 * Paints the solved character. `rim` is the colour of the soft glow around the silhouette
 * (the light behind the scene); `look` moves the eyes, -1..1 on each axis.
 */
export function drawStickman(ctx, j, { color = '#07080a', rim = 'rgba(180, 195, 220, 0.45)', rimBlur = 16, expression = 'calm', look = [0, 0], props = {} } = {}) {
  const { r } = j;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const body = () => {
    if (j.muscle) drawMuscle(ctx, j); else drawSlim(ctx, j, props);
    dot(ctx, j.head, r);
    if (props.bun) dot(ctx, add(j.head, dir(j.headAngle + 42, j.face), r * 0.98), r * 0.48);
  };
  // Twice: once with the glow, then again without, so the glow never shows between overlapping parts.
  ctx.shadowColor = rim;
  ctx.shadowBlur = rimBlur * j.s;
  body();
  ctx.shadowBlur = 0;
  body();
  drawFace(ctx, j, expression, look, props);
  ctx.restore();
}

function drawFace(ctx, j, expression, [lx, ly], props) {
  const { r, face } = j;
  const tilt = j.pose.tilt + j.pose.lean;
  const cx = j.head[0] + face * r * 0.3 + lx * r * 0.16;
  const cy = j.head[1] - r * 0.06 + ly * r * 0.2 + (tilt / 90) * r * 0.35;
  const eyes = [cx - r * 0.24, cx + r * 0.24];
  ctx.fillStyle = EYE;
  ctx.strokeStyle = EYE;
  ctx.lineCap = 'round';

  const arcs = () => {
    ctx.lineWidth = r * 0.1;
    for (const ex of eyes) {
      ctx.beginPath();
      ctx.moveTo(ex - r * 0.13, cy + r * 0.05);
      ctx.lineTo(ex, cy - r * 0.09);
      ctx.lineTo(ex + r * 0.13, cy + r * 0.05);
      ctx.stroke();
    }
  };
  const lids = (slant, open = 0.16) => {
    eyes.forEach((ex, i) => {
      ctx.beginPath();
      ctx.ellipse(ex, cy, r * 0.17, r * open, (i === 0 ? -slant : slant) * face, 0, Math.PI);
      ctx.fill();
    });
  };

  if (props.shades) {
    ctx.fillStyle = '#1b1e24';
    ctx.strokeStyle = 'rgba(243, 238, 231, 0.55)';
    ctx.lineWidth = r * 0.05;
    ctx.beginPath();
    ctx.roundRect(cx - r * 0.5, cy - r * 0.16, r * 1.0, r * 0.3, r * 0.1);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = EYE;
    ctx.lineWidth = r * 0.06;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.34, cy + r * 0.06);
    ctx.lineTo(cx - r * 0.24, cy - r * 0.08);
    ctx.stroke();
    ctx.fillStyle = EYE;
    if (expression === 'laugh') mouth(ctx, cx, cy + r * 0.42, r * 0.24);
    if (expression === 'shock') dot(ctx, [cx, cy + r * 0.48], r * 0.1);
    return;
  }

  switch (expression) {
    case 'smug':
      lids(0.25, 0.13);
      break;
    case 'laugh':
      arcs();
      mouth(ctx, cx, cy + r * 0.4, r * 0.25);
      break;
    case 'happy':
      arcs();
      ctx.lineWidth = r * 0.08;
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.26, r * 0.16, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
      break;
    case 'shock':
      for (const ex of eyes) dot(ctx, [ex, cy], r * 0.17);
      dot(ctx, [cx, cy + r * 0.45], r * 0.11);
      break;
    case 'sad':
      lids(-0.35, 0.14);
      break;
    case 'nervous': {
      for (const ex of eyes) {
        ctx.beginPath();
        ctx.ellipse(ex, cy, r * 0.12, r * 0.17, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // A sweat drop on the far side of the head.
      const dx = j.head[0] - face * r * 0.95, dy = j.head[1] - r * 0.25;
      ctx.fillStyle = 'rgba(205, 225, 245, 0.9)';
      ctx.beginPath();
      ctx.moveTo(dx, dy - r * 0.28);
      ctx.quadraticCurveTo(dx + r * 0.17, dy, dx, dy + r * 0.12);
      ctx.quadraticCurveTo(dx - r * 0.17, dy, dx, dy - r * 0.28);
      ctx.fill();
      break;
    }
    default:
      for (const ex of eyes) {
        ctx.beginPath();
        ctx.ellipse(ex, cy, r * 0.14, r * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
  }
}

function mouth(ctx, x, y, size) {
  ctx.beginPath();
  ctx.arc(x, y - size * 0.35, size, 0.05 * Math.PI, 0.95 * Math.PI);
  ctx.closePath();
  ctx.fill();
}
