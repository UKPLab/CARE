/**
 * Horizontal-scroll affordance for Table.vue (BasicTable) and BackendTable.vue.
 *
 * Wide tables scroll sideways inside `.table-wrapper`, and users often miss the
 * thin bottom scrollbar. This helper tracks whether more content is hidden on the
 * left or right and exposes the geometry for an edge fade plus a small chevron
 * button rendered next to the wrapper (see ScrollHints.vue). The overlay lives
 * outside the scrolled content, so it stays put while the table moves.
 *
 * Sticky columns (fixed left/right, sticky manage column) are excluded from the
 * hint area so the fade sits on the edge of the part that actually scrolls.
 *
 * Uses the same `tableWrapper` / `tableElement` refs as tableFixedColumns.js.
 * The wrapper's offsetParent must be the element ScrollHints.vue is rendered in
 * (a `position: relative` frame), so offsets map directly onto the overlay.
 */

/** Pixels of slack so sub-pixel scroll positions do not leave a hint visible at the end. */
const EDGE_TOLERANCE = 2;

/** Share of the visible width scrolled by one chevron click. */
const SCROLL_STEP = 0.8;

export function tableScrollHintsData() {
  return {
    scrollHintLeft: false,
    scrollHintRight: false,
    scrollHintFrame: null,
  };
}

/**
 * Sum the widths of sticky header cells on one side.
 * @param {HTMLElement} table
 * @param {string} side "left" | "right"
 * @returns {number}
 */
function stickyWidth(table, side) {
  const cells = table.querySelectorAll(`thead > tr > th.table-fixed-${side}`);
  let width = 0;
  cells.forEach((cell) => {
    width += cell.offsetWidth;
  });
  return width;
}

/**
 * Sticky columns can switch on without the table changing size (e.g. the manage
 * column becomes sticky once overflow is detected), so recompute when the fixed
 * column layout is recalculated.
 */
export const tableScrollHintsWatch = {
  fixedColumnStyles() {
    this.$nextTick(() => this.updateScrollHints());
  },
  manageColumnStyle() {
    this.$nextTick(() => this.updateScrollHints());
  },
};

export const tableScrollHintsMethods = {
  /** Call from `mounted()`. */
  setupScrollHints() {
    this.$nextTick(() => {
      const wrapper = this.$refs.tableWrapper;
      if (!wrapper) return;
      this._stopScrollHints?.();

      let frame = null;
      const schedule = () => {
        if (frame !== null) return;
        frame = requestAnimationFrame(() => {
          frame = null;
          this.updateScrollHints();
        });
      };

      wrapper.addEventListener("scroll", schedule, { passive: true });
      let observer = null;
      if (window.ResizeObserver) {
        observer = new ResizeObserver(schedule);
        observer.observe(wrapper);
        if (this.$refs.tableElement) observer.observe(this.$refs.tableElement);
      } else {
        window.addEventListener("resize", schedule);
      }

      this._stopScrollHints = () => {
        wrapper.removeEventListener("scroll", schedule);
        observer?.disconnect();
        window.removeEventListener("resize", schedule);
        if (frame !== null) cancelAnimationFrame(frame);
      };
      this.updateScrollHints();
    });
  },
  /** Call from `beforeUnmount()`. */
  cleanupScrollHints() {
    this._stopScrollHints?.();
    this._stopScrollHints = null;
  },
  updateScrollHints() {
    const wrapper = this.$refs.tableWrapper;
    const table = this.$refs.tableElement;
    if (!wrapper || !table || wrapper.offsetParent === null) {
      // Hidden (e.g. card view): nothing to hint at
      this.scrollHintLeft = false;
      this.scrollHintRight = false;
      return;
    }

    const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;
    // scrollLeft is negative in RTL layouts; the magnitude is what matters
    const position = Math.abs(wrapper.scrollLeft);
    this.scrollHintLeft = maxScroll > EDGE_TOLERANCE && position > EDGE_TOLERANCE;
    this.scrollHintRight = maxScroll > EDGE_TOLERANCE && position < maxScroll - EDGE_TOLERANCE;

    if (!this.scrollHintLeft && !this.scrollHintRight) return;

    // Place the overlay over the scrolling area only: above the native horizontal
    // scrollbar, left of a vertical one, and between the sticky columns.
    const leftSticky = stickyWidth(table, "left");
    const rightSticky = stickyWidth(table, "right");
    const next = {
      top: wrapper.offsetTop,
      height: wrapper.clientHeight,
      left: wrapper.offsetLeft + leftSticky,
      width: Math.max(0, wrapper.clientWidth - leftSticky - rightSticky),
    };
    const prev = this.scrollHintFrame;
    if (!prev || Object.keys(next).some((k) => prev[k] !== next[k])) {
      this.scrollHintFrame = next;
    }
  },
  /**
   * Scroll the table by most of a screen in the given direction.
   * @param {number} direction -1 for left, 1 for right
   */
  scrollTableBy(direction) {
    const wrapper = this.$refs.tableWrapper;
    if (!wrapper) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    wrapper.scrollBy({
      left: direction * wrapper.clientWidth * SCROLL_STEP,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  },
};
