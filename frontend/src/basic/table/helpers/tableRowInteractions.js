/**
 * Row-selection and action-relay subsystem for Table.vue (BasicTable).
 *
 * Owns single/multiple row selection (by click or checkbox), select-all
 * across filtered data, `modelValue` synchronization (with a
 * deep-equality fallback for rows without an `id`), and relaying
 * per-row button/toggle actions (with optional stats emission).
 *
 * Exports a data factory, computed properties, and methods for spread
 * composition into Table.vue.
 *
 * @author Dennis Zyska, Nils Dycke, Linyin Huang
 */

import deepEqual from "deep-equal";

// Fresh data factory so selection state is never shared across table instances
export function tableRowInteractionsData() {
  return {
    currentData: [],
  };
}

export const tableRowInteractionsComputed = {
  isAllRowsSelected() {
    // Use the existing method to get filtered data across all pages
    const allFilteredData = this.getFilteredAndSortedData();
    const enabledFilteredRows = allFilteredData.filter((r) => !r.isDisabled);
    return this.currentData.length === enabledFilteredRows.length && enabledFilteredRows.length > 0;
  },
  selectedCount() {
    return this.currentData.length;
  },
  totalSelectableCount() {
    if (!this.selectableRows) return 0;
    const allFilteredData = this.getFilteredAndSortedData();
    return allFilteredData.filter((r) => !r.isDisabled).length;
  },
};

export const tableRowInteractionsMethods = {
  actionEmitter(data) {
    this.$emit("action", data);
    let statsParams = {};
    if (data.stats) {
      // Only include the stat fields in the stats data
     Object.entries(data.stats).forEach(([statsKey, paramKey]) => {
      statsParams[statsKey] = data.params[paramKey];
    });
    }
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "actionClick",
          data: {
            action: data.action,
            params: statsParams,
          },
        });
      }
  },
  selectRow(row) {
    if (this.selectableRows) {
      if (!this.isRowSelected(row)) {
        // check if selected
        if (this.options && this.options.singleSelect) {
          this.currentData = [row];
        } else {
          this.currentData.push(row);
        }
      } else {
        const toRemove = this.currentData.findIndex((r) => r.id !== undefined ? r.id === row.id : deepEqual(r, row));
        if (toRemove >= 0) {
          this.currentData.splice(toRemove, 1);
        }
      }
    }
  },
  selectAllRows() {
    if (this.isAllRowsSelected) {
      this.currentData = [];
    } else {
      // Use the existing method to get filtered data across all pages
      const allFilteredData = this.getFilteredAndSortedData();
      // Select all filtered rows that are not disabled
      this.currentData = [...allFilteredData.filter((t) => !t.isDisabled)];
    }
  },
  updateValues(data) {
    return data;
  },
  // NOTE: Because deepEqual is imported after its reference in the template.
  // Therefore, add this wrapper function here to prevent reference error.
  deepEqual(row1, row2) {
    return deepEqual(row1, row2);
  },
  isRowSelected(row) {
    if (row.id !== undefined) {
      return this.currentData.some(r => r.id === row.id);
    }
    return this.currentData.some(r => deepEqual(r, row));
  },
};
