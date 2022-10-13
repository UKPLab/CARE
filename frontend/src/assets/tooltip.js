import { Tooltip } from 'bootstrap'

export const tooltip = {

  mounted(el) {
    const tooltip = new Tooltip(el)
  },

  updated(el) {
    const tooltip = new Tooltip(el)
  }

}