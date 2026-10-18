/**
 * Sticky ("fixed") columns shared by BasicTable (Table.vue) and BackendTable.vue.
 *
 * A column opts in with `fixed: "left"` or `fixed: "right"`. The Manage column sticks to the
 * right edge as soon as the table overflows horizontally or has right-fixed columns.
 *
 * Both tables use the same template refs, which the measuring helpers read:
 * `tableWrapper`, `tableElement`, `manageHeader` and `header-<column.key>`.
 *
 * @author Andrii Nikitin
 */

const STICKY_BASE_STYLE = {
  position: "sticky",
  zIndex: 2,
  background: "var(--bs-body-bg, #fff)",
};

/** Default width when a column has neither an explicit width nor a rendered header. */
const DEFAULT_COLUMN_WIDTH = 150;

/** `ref` inside v-for is an array; outside it is the element itself. */
export function firstRef(ref) {
  return Array.isArray(ref) ? ref[0] : ref;
}

export function hasFixedColumns(columns) {
  return columns.some((c) => ["left", "right"].includes(c.fixed));
}

export function hasRightFixedColumns(columns) {
  return columns.some((c) => c.fixed === "right");
}

/** Manage column is sticky when there are buttons and the table overflows or has right-fixed columns. */
export function shouldFixManageColumn(hasManageButtons, hasHorizontalOverflow, columns) {
  return hasManageButtons && (hasHorizontalOverflow || hasRightFixedColumns(columns));
}

/** Indices of the last left-fixed and first right-fixed column (they get the shadow). */
export function fixedColumnIndices(columns) {
  return {
    lastLeft: columns.findLastIndex((col) => col.fixed === "left"),
    firstRight: columns.findIndex((col) => col.fixed === "right"),
  };
}

/**
 * CSS classes of a header / body cell of a fixed column.
 * @param {Object} column
 * @param {number} index position in the visible columns
 * @param {{lastLeft: number, firstRight: number}} indices from fixedColumnIndices()
 */
export function fixedColumnClass(column, index, indices) {
  if (!column?.fixed) return null;

  const { lastLeft, firstRight } = indices;
  const isLastLeft = column.fixed === "left" && index === lastLeft;
  const isFirstRight = column.fixed === "right" && index === firstRight;

  return {
    "table-fixed": true,
    "table-fixed-left": column.fixed === "left",
    "table-fixed-right": column.fixed === "right",
    "table-fixed-shadow": isLastLeft || isFirstRight,
  };
}

/** CSS classes of the Manage column cells. */
export function manageColumnClass(fixManageColumn, hasRightFixed) {
  if (!fixManageColumn) return null;

  return {
    "table-fixed": true,
    "table-fixed-right": true,
    "table-fixed-shadow": !hasRightFixed,
  };
}

/** Sticky style of one column, taken from the styles computed by measureFixedColumns(). */
export function fixedColumnStyle(columnStyles, column) {
  if (!column?.key || !column?.fixed) return null;
  return columnStyles[column.key] || null;
}

/** Explicit width (fixedWidth / widthPx / width), otherwise the rendered header width. */
export function columnWidth(column, headerEl) {
  if (column.fixedWidth) return Number(column.fixedWidth);
  if (column.widthPx) return Number(column.widthPx);
  if (column.width) return Number(column.width);

  if (headerEl?.offsetWidth) return headerEl.offsetWidth;

  return DEFAULT_COLUMN_WIDTH;
}

export function hasHorizontalOverflow(wrapper, table) {
  if (!wrapper || !table) return false;
  return table.scrollWidth > wrapper.clientWidth;
}

/**
 * Sticky offsets for left / right fixed columns and the Manage column.
 * @param {Object[]} columns visible columns, in render order
 * @param {{fixManageColumn: boolean, getColumnWidth: function(Object): number, getManageColumnWidth: function(): number}} options
 * @returns {{columnStyles: Object<string, Object>, manageColumnStyle: Object|null}}
 */
export function fixedColumnLayout(columns, { fixManageColumn, getColumnWidth, getManageColumnWidth }) {
  if (!hasFixedColumns(columns) && !fixManageColumn) {
    return { columnStyles: {}, manageColumnStyle: {} };
  }

  const columnStyles = {};

  let leftOffset = 0;
  columns.forEach((column) => {
    if (column.fixed === "left") {
      columnStyles[column.key] = {
        ...STICKY_BASE_STYLE,
        left: `${leftOffset}px`,
      };
      leftOffset += getColumnWidth(column);
    }
  });

  // Reserve space for the Manage column if it sticks to the right edge.
  let rightOffset = fixManageColumn ? getManageColumnWidth() : 0;

  // Right-fixed columns, from right to left.
  [...columns]
    .reverse()
    .filter((c) => c.fixed === "right")
    .forEach((column) => {
      columnStyles[column.key] = {
        ...STICKY_BASE_STYLE,
        right: `${rightOffset}px`,
      };
      rightOffset += getColumnWidth(column);
    });

  const manageColumnStyle = fixManageColumn
    ? {
        ...STICKY_BASE_STYLE,
        right: "0px",
        zIndex: 3, // Above the right-fixed columns
      }
    : null;

  return { columnStyles, manageColumnStyle };
}

/**
 * Measure the rendered table and compute the sticky layout.
 * @param {Object} refs component `$refs`
 * @param {{columns: Object[], hasManageButtons: boolean, manageFallbackWidth: number}} options
 *   `manageFallbackWidth` is used while the Manage header is not rendered yet
 * @returns {{hasOverflow: boolean, columnStyles: Object<string, Object>, manageColumnStyle: Object|null}}
 */
export function measureFixedColumns(refs, { columns, hasManageButtons, manageFallbackWidth }) {
  const hasOverflow = hasHorizontalOverflow(refs.tableWrapper, refs.tableElement);
  const layout = fixedColumnLayout(columns, {
    fixManageColumn: shouldFixManageColumn(hasManageButtons, hasOverflow, columns),
    getColumnWidth: (column) => columnWidth(column, firstRef(refs[`header-${column.key}`])),
    getManageColumnWidth: () => firstRef(refs.manageHeader)?.offsetWidth || manageFallbackWidth,
  });
  return { hasOverflow, ...layout };
}

/**
 * Call `onResize` when the table changes size. Uses ResizeObserver on the given elements
 * (the first one is required), falling back to the window resize event.
 * @param {Array<Element|undefined>} elements
 * @param {function} onResize
 * @returns {function} stop observing
 */
export function observeResize(elements, onResize) {
  const [primary] = elements;
  if (window.ResizeObserver && primary) {
    const observer = new ResizeObserver(onResize);
    elements.filter(Boolean).forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}
