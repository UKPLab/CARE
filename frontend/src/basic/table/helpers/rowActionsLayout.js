/**
 * Split of row actions into inline icons and the "more" menu, shared by
 * ButtonGroup.vue (rendering) and BackendTable.vue (manage column width).
 *
 * Layout options (usually `options.rowActions` of the table):
 * - `maxInline`: icons kept inline (default 3). One extra action is shown inline
 *   instead of a menu holding a single entry. Use `Infinity` to never collapse.
 * - `inline`: action names to prefer inline, in this order.
 * - `menuOnly`: action names that always go into the menu.
 *
 * Destructive actions (btn-outline-danger) always come last and are never inline
 * while there is a menu.
 */

export const DEFAULT_MAX_INLINE = 3;

export function isDangerButton(button) {
  return !!button?.options?.specifiers?.["btn-outline-danger"];
}

/**
 * @param {Object[]} buttons
 * @param {Object} [layout]
 * @returns {{inline: Object[], menu: Object[]}}
 */
export function splitRowActions(buttons, layout) {
  const maxInline = layout?.maxInline ?? DEFAULT_MAX_INLINE;
  const preferredNames = layout?.inline || [];
  const menuOnly = layout?.menuOnly || [];

  const ordered = [
    ...buttons.filter((b) => !isDangerButton(b)),
    ...buttons.filter((b) => isDangerButton(b)),
  ];
  if (ordered.length <= maxInline + 1) {
    return { inline: ordered, menu: [] };
  }

  const preferred = preferredNames
    .map((name) => ordered.find((b) => b.action === name))
    .filter((b) => b && !isDangerButton(b));
  const fill = ordered.filter(
    (b) => !isDangerButton(b) && !preferred.includes(b) && !menuOnly.includes(b.action)
  );
  const inline = [...preferred, ...fill].slice(0, maxInline);
  return { inline, menu: ordered.filter((b) => !inline.includes(b)) };
}

/**
 * Upper bound of buttons a row renders (inline icons + "more"), for column sizing.
 * @param {number} buttonCount
 * @param {Object} [layout]
 * @returns {number}
 */
export function rowActionSlots(buttonCount, layout) {
  const maxInline = layout?.maxInline ?? DEFAULT_MAX_INLINE;
  return buttonCount > maxInline + 1 ? maxInline + 1 : buttonCount;
}
