import { Tooltip } from 'bootstrap'

/**
 * Bootstrap tooltip directive, created lazily.
 *
 *   <span v-tooltip :title="text">          always on
 *   <span v-tooltip="!!text" :title="text"> off while the value is false
 *
 * The Bootstrap instance is only built on the first hover / focus. Table badges and icons
 * carry this directive in every row, and building a Tooltip (config parsing, title move,
 * five listeners) for each of them on mount was wasted work for tooltips nobody hovers.
 *
 * The previous version also created a new instance in every `updated` hook without disposing
 * the old one, and its cleanup hook was named `unmount` (Vue calls `unmounted`), so instances
 * and their listeners piled up on every re-render and were never released.
 * @type {import('vue').ObjectDirective}
 */

const STATE = Symbol("careTooltip");

function replay(el, event) {
  // The instance missed the event that created it; send it again so the first hover counts.
  const init = {bubbles: true, relatedTarget: event.relatedTarget ?? null};
  const copy = event.type === "focusin" ? new FocusEvent("focusin", init) : new MouseEvent("mouseover", init);
  el.dispatchEvent(copy);
}

function activate(event) {
  const el = event.currentTarget;
  const state = el[STATE];
  if (!state || state.instance || !state.enabled) return;
  detachLazy(el);
  state.instance = Tooltip.getOrCreateInstance(el, {delay: 500});
  el.addEventListener("click", state.onClick);
  replay(el, event);
}

function attachLazy(el) {
  el.addEventListener("mouseover", activate);
  el.addEventListener("focusin", activate);
}

function detachLazy(el) {
  el.removeEventListener("mouseover", activate);
  el.removeEventListener("focusin", activate);
}

function dispose(el) {
  const state = el[STATE];
  if (!state) return;
  detachLazy(el);
  el.removeEventListener("click", state.onClick);
  if (state.instance) {
    state.instance.dispose();
    state.instance = null;
  }
}

export const tooltip = {
  mounted(el, binding) {
    const state = {
      instance: null,
      enabled: binding.value !== false,
      onClick: () => state.instance?.hide(),
    };
    el[STATE] = state;
    if (state.enabled) attachLazy(el);
  },

  updated(el, binding) {
    const state = el[STATE];
    if (!state) return;
    const enabled = binding.value !== false;
    if (!enabled) {
      dispose(el);
      state.enabled = false;
      return;
    }
    if (!state.enabled) {
      state.enabled = true;
      attachLazy(el);
      return;
    }
    // Vue wrote a new title attribute: hand it to the live instance instead of rebuilding it.
    const title = el.getAttribute("title");
    if (state.instance && title) {
      el.setAttribute("data-bs-original-title", title);
      el.removeAttribute("title");
      state.instance.setContent({".tooltip-inner": title});
    }
  },

  unmounted(el) {
    dispose(el);
    delete el[STATE];
  },
}
