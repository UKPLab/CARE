/**
 * Motion helpers for ScientistMascot.vue.
 *
 * The mascot is animated with damped springs instead of CSS keyframes: every moving value
 * (wrist, elbow, hand angle, head tilt, mouth shape, ...) follows its target with a bit of
 * inertia and overshoot, which keeps the motion soft and continuous even when the target
 * changes in the middle of a move.
 *
 * An arm is drawn as one sleeve from the shoulder over the elbow to the wrist. Poses set
 * the wrist, the elbow and the hand angle explicitly. That allows cartoon foreshortening
 * (an elbow pointing at the viewer looks short) and keeps the elbow from flipping sides
 * between poses.
 *
 * All coordinates are in the SVG viewBox of the mascot (0 0 160 150). The card covers
 * everything below y = 133.
 */

export const DEG = Math.PI / 180;

/** Shoulder joints, inside the rounded shoulders of the coat */
export const SHOULDER = {
  L: { x: 59, y: 117 },
  R: { x: 101, y: 117 },
};

/** Distance from the wrist to the palm center along the fingers */
export const PALM_OFFSET = 15;

/**
 * Arm poses.
 * - w: wrist position
 * - e: elbow position
 * - a: hand angle in degrees, 0 = fingers up, positive = clockwise
 */
export const POSES = {
  // Arms hanging down along the body, hands behind the card
  restL: { w: [57, 174], e: [55, 146], a: 180 },
  restR: { w: [103, 174], e: [105, 146], a: 180 },
  // Palms over the glasses, elbows down at the sides of the chest
  coverL: { w: [62, 81], e: [48, 113], a: 15 },
  coverR: { w: [98, 81], e: [112, 113], a: -15 },
  // Right hand raised next to the head
  waveR: { w: [134, 96], e: [124, 124], a: 20 },
  // Right hand under the card at the side of the body, about to bring the magnifier up
  lowR: { w: [106, 175], e: [106, 147], a: -6 },
  // Right forearm raised at the side of the body, magnifier lens over the right eye
  peekR: { w: [99.94, 120.68], e: [111, 146], a: -6.2 },
  // Hands under the stored documents, behind the card
  docsPickupL: { w: [56.4, 169.9], e: [52, 144], a: 22 },
  docsPickupR: { w: [103.6, 169.9], e: [108, 144], a: -22 },
  // Holding the documents in front of the chest
  readL: { w: [56, 136], e: [44, 140], a: 22 },
  readR: { w: [104, 136], e: [116, 140], a: -22 },
};

/**
 * Magnifier when not in use: upright and fully hidden behind the card, below the right hand.
 * Same local coordinates as the right hand; the lens is at (0, -55).
 */
export const MAGNIFIER_STORED = { x: 108, y: 207, angle: 0 };

/** Point of the magnifier handle that the hand grips, in hand coordinates */
export const MAGNIFIER_GRIP = { x: 0, y: -22 };

/** Documents stored behind the card */
export const DOCS_STORED = { x: 80, y: 156, angle: 0 };

/** Mouth shapes: corner width, left/right corner height, upper lip curve, opening */
export const MOUTHS = {
  smile: { w: 18, yl: 83, yr: 83, c: 8, open: 0 },
  content: { w: 20, yl: 82, yr: 82, c: 8, open: 5 },
  grin: { w: 22, yl: 80, yr: 80, c: 1, open: 20 },
  o: { w: 7, yl: 84, yr: 84, c: -3, open: 9 },
  smirk: { w: 15, yl: 86, yr: 81, c: 3, open: 0 },
  focus: { w: 10, yl: 86, yr: 86, c: 2, open: 0 },
};

/**
 * Create a damped spring.
 * @param {number} value - start value
 * @param {number} stiffness - higher is faster
 * @param {number} [dampingRatio=0.75] - 1 = no overshoot, lower = more bounce
 */
export function spring(value, stiffness, dampingRatio = 0.75) {
  return {
    x: value,
    v: 0,
    target: value,
    k: stiffness,
    d: 2 * dampingRatio * Math.sqrt(stiffness),
  };
}

export function setStiffness(s, stiffness, dampingRatio = 0.75) {
  s.k = stiffness;
  s.d = 2 * dampingRatio * Math.sqrt(stiffness);
}

export function stepSpring(s, dt) {
  const a = s.k * (s.target - s.x) - s.d * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
}

export function snapSpring(s) {
  s.x = s.target;
  s.v = 0;
}

/** Wrap an angle in degrees to [-180, 180) */
export function wrapAngle(a) {
  return ((a + 180) % 360 + 360) % 360 - 180;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/** Rotate a point by an angle in degrees (clockwise on screen) */
export function rotate(p, angle) {
  const c = Math.cos(angle * DEG);
  const s = Math.sin(angle * DEG);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

/** Palm center in viewBox coordinates for a wrist position and hand angle */
export function palmCenter(wrist, angle) {
  const offset = rotate({ x: 0, y: -PALM_OFFSET }, angle);
  return { x: wrist.x + offset.x, y: wrist.y + offset.y };
}

/** Point at a distance from `from` toward `to` (or `to` itself if it is closer) */
export function pointToward(from, to, distance) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length <= distance) {
    return { ...to };
  }
  return { x: from.x + (dx / length) * distance, y: from.y + (dy / length) * distance };
}

/** Smooth 0 -> 1 -> 0 bump over t in [0, 1] */
export function bump(t) {
  return t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t);
}
