/**
 * Helpers of the optional point bounds (minimum / maximum) shared by criteria and rubrics.
 *
 * A bound is `null` while it is not active, otherwise any finite number (negative and decimal values included).
 * The form never clamps a value: the slider only follows the entered numbers, it does not limit them.
 * No `@/` imports (plain Node tests).
 *
 * @author Eyad Mohamed
 */

/** Slider range when no number is entered: -10 to 10. */
export const DEFAULT_SLIDER_RANGE = Object.freeze({ min: -10, max: 10 });

const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

/**
 * Value of a bound from the text of the number input. Empty or not a number is `null` (not active) and
 * reported by the caller as an error when the text is not empty.
 *
 * @param {string} raw - Input value
 * @returns {number|null}
 */
export function parseBound(raw) {
  const text = String(raw ?? "").trim();
  if (text === "") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/**
 * Range of the slider for the current bound. It always contains the value of this bound and the value of the
 * other bound, so the thumb is never outside the track, rounded outward to a multiple of 10, and at least
 * -10 to 10. The range grows when larger numbers are entered and shrinks back when they are removed.
 *
 * @param {number|null} value - This bound
 * @param {number|null} [other] - The other bound (null when not active)
 * @returns {{min: number, max: number}}
 */
export function sliderRange(value, other = null) {
  const numbers = [value, other].filter(isNumber);
  if (!numbers.length) return { ...DEFAULT_SLIDER_RANGE };
  const low = Math.min(DEFAULT_SLIDER_RANGE.min, ...numbers);
  const high = Math.max(DEFAULT_SLIDER_RANGE.max, ...numbers);
  return { min: Math.floor(low / 10) * 10, max: Math.ceil(high / 10) * 10 };
}

/**
 * Step of the slider: whole numbers, or tenths when the value has decimals (the numeric input still accepts
 * any decimal).
 *
 * @param {number|null} value - This bound
 * @returns {number}
 */
export function sliderStep(value) {
  return isNumber(value) && !Number.isInteger(value) ? 0.1 : 1;
}

/**
 * Error key of the pair of bounds (relative to `assessmentManagement.errors`), or undefined: both active and
 * minimum greater than maximum.
 *
 * @param {number|null} min
 * @param {number|null} max
 * @returns {string|undefined}
 */
export function boundsError(min, max) {
  return isNumber(min) && isNumber(max) && min > max ? "maxBelowMin" : undefined;
}
