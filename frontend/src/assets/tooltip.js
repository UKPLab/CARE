import { Tooltip } from 'bootstrap'

export const tooltip = {

  mounted(el) {
    const tt = new Tooltip(el, {delay: 500});
    el.addEventListener("click", () => tt.dispose());
  },

  updated(el) {
    const tt = new Tooltip(el, {delay: 500});
    el.addEventListener("click", () => tt.dispose());
  },
}