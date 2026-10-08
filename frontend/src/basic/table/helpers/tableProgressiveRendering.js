/**
 * "All" mode progressive-rendering subsystem for Table.vue (BasicTable).
 *
 * When itemsPerPage is set to 0 ("All"), renders a growing prefix of the
 * filtered/sorted data instead of the full set at once, appending the
 * next chunk when a sentinel row scrolls into view. Kept separate from
 * tableFixedColumns.js: both are independent DOM-measurement
 * subsystems, but neither depends on the other.
 *
 * Exports a data factory and methods for spread composition into
 * Table.vue.
 *
 * @author Dennis Zyska, Nils Dycke, Linyin Huang
 */

// Fresh data factory so observer/render-limit state is never shared across table instances
export function tableProgressiveRenderingData() {
  return {
    allRenderLimit: 75, // Render only the first 75 items when "All" is selected to avoid UI freeze
    allChunkSize: 50, // Append the next 50 items on scroll
    allObserver: null,
  };
}

export const tableProgressiveRenderingMethods = {
  setupAllObserver() {
    this.cleanupAllObserver();

    const wrapper = this.$refs.tableWrapper;
    const sentinel = this.$refs.loadMoreSentinel;
    if (!sentinel) return;

    // If there is a scroll container (maxTableHeight), observe within it.
    // Otherwise observe in the viewport.
    const root = wrapper && this.maxTableHeight ? wrapper : null;

    this.allObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;

        if (this.allRenderLimit < this.total) {
          this.allRenderLimit = Math.min(this.total, this.allRenderLimit + this.allChunkSize);
        }
      },
      {
        root,
        threshold: 0.1,
      }
    );

    this.allObserver.observe(sentinel);
  },

  cleanupAllObserver() {
    if (this.allObserver) {
      this.allObserver.disconnect();
      this.allObserver = null;
    }
  },
};
