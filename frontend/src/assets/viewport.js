/**
 * Shared, reactive viewport flags for layouts that cannot be done in CSS alone
 * (how many buttons are shown, whether a menu is a strip or a drawer).
 *
 * `compact` is true below Bootstrap's md breakpoint (< 768px): phones and narrow
 * windows. Use the same width in CSS: @media (max-width: 767.98px).
 *
 * Reading `viewport.compact` inside a computed or render makes it reactive.
 */
import { reactive } from "vue";

export const COMPACT_QUERY = "(max-width: 767.98px)";

export const viewport = reactive({
  compact: false,
});

if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
  const query = window.matchMedia(COMPACT_QUERY);
  viewport.compact = query.matches;
  const update = (event) => {
    viewport.compact = event.matches;
  };
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", update);
  } else {
    // Safari < 14
    query.addListener(update);
  }
}
