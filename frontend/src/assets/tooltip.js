import { Tooltip } from 'bootstrap'

/**
 * Defines a tooltip directive to be used in boostrap components.
 * @type {Object}
 */
export const tooltip = {
  mounted(el) {
    const tt = new Tooltip(el, {delay: 500});
    el.addEventListener("click", () => tt.dispose());
  },

  updated(el) {
    const tt = new Tooltip(el, {delay: 500});
    el.addEventListener("click", () => tt.dispose());
  },

  unmount(el) {
    el.removeEventListener("click");
  }
}