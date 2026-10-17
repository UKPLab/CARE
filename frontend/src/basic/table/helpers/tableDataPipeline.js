/**
 * Filter -> sort -> paginate data pipeline for Table.vue (BasicTable).
 *
 * Owns the search/checkbox/numeric-filter/sort/groupBy pipeline
 * (`getFilteredAndSortedData`), the resulting sequelize-shaped filter
 * payload, and both client-side and server-side pagination state and
 * calculations (including the itemsPerPage = 0 "All" mode).
 *
 * Exports a data factory, computed properties, and methods for spread
 * composition into Table.vue.
 *
 * @author Dennis Zyska, Nils Dycke, Linyin Huang
 */

// Fresh data factory so pipeline/pagination state is never shared across table instances.
// `options` is passed in explicitly since this runs inside Table.vue's own data() function.
export function tableDataPipelineData(options) {
  return {
    sortColumn: options && options.sort && options.sort.column ? options.sort.column : null,
    sortDirection: options && options.sort && options.sort.order ? options.sort.order : "ASC",
    currentPage: 1,
    itemsPerPage: null,
    itemsPerPageList: [10, 25, 50, 100],
    paginationShowPages: 3,
    filter: null, // Can be assigned an object or an array, see example in Table.vue file.
    search: "",
  };
}

export const tableDataPipelineComputed = {
  hasFilterableData() {
    return this.data && this.data.length > 0;
  },
  serverSidePagination() {
    return (
      this.options &&
      this.options.pagination &&
      typeof this.options.pagination === "object" &&
      "serverSide" in this.options.pagination &&
      this.options.pagination.serverSide
    );
  },
  total() {
    if (this.serverSidePagination) {
      return this.options.pagination.total;
    }
    return this.data.length;
  },
  isAllMode() {
    return this.itemsPerPage === 0;
  },
  limit() {
    // if manually set, use that
    if (this.itemsPerPage !== null) {
      if (this.itemsPerPage === 0) {
        // Prevent UI freeze when "All" is selected
        return Math.min(this.total, this.allRenderLimit);
      }
      return this.itemsPerPage;
    }
    // if pagination is enabled, use that
    if (this.options && this.options.pagination) {
      if (typeof this.options.pagination === "object") {
        return this.options.pagination.itemsPerPage;
      } else {
        return this.options.pagination;
      }
    }
    // otherwise, use all elements
    return this.total;
  },
  pages() {
    if (this.isAllMode) {
      return 1;
    }
    if (this.serverSidePagination) {
      return Math.ceil(this.total / this.limit);
    }
    // For client-side pagination, use filtered data length
    return Math.ceil(this.filteredDataLength / this.limit);
  },
  filteredDataLength() {
    if (this.serverSidePagination) {
      return this.total;
    }

    return this.getFilteredAndSortedData().length;
  },
  sortIcon() {
    return this.sortDirection === "ASC" ? "sort-down" : "sort-up";
  },
  tableData() {
    if (this.serverSidePagination) {
      return this.data;
    }

    let data = this.getFilteredAndSortedData();

    if (this.options && this.options.pagination && !this.isAllMode) {
      data = data.slice((this.currentPage - 1) * this.limit, this.currentPage * this.limit);
    } else if (this.isAllMode) {
      // In "All" mode we render a growing prefix (0..limit)
      data = data.slice(0, this.limit);
    }
    return data;
  },
  sequelizeFilter() {
    // filter is only initialized in Table.vue's mounted(), but HeaderCell props read this on the first render
    if (!this.filter) return {};
    let sequelizeFilter = Object.assign(
      {},
      ...Object.entries(this.filter).map(([k, v]) => ({
        [k]: Object.entries(v)
          .filter(([_k, v]) => v)
          .map(([k, _v]) => k),
      }))
    );
    return Object.assign(
      {},
      ...Object.entries(sequelizeFilter)
        .filter(([_k, v]) => v.length > 0)
        .map(([k, v]) => ({ [k]: v }))
    );
  },
};

export const tableDataPipelineMethods = {
  getFilteredAndSortedData() {
    let data = this.data.map((d) => d);

    // Apply search filter
    if (this.search && this.search !== "") {
      data = data.filter((d) => {
        for (const [_key, value] of Object.entries(d)) {
          if (typeof value === "string" && value.toLowerCase().includes(this.search.toLowerCase())) {
            return true;
          }
        }
        return false;
      });
    }

    // Apply sorting (pre-group)
    if (this.sortColumn) {
      if (this.sortDirection === "ASC") {
        data = data.sort((a, b) => (a[this.sortColumn] > b[this.sortColumn] ? 1 : b[this.sortColumn] > a[this.sortColumn] ? -1 : 0));
      } else {
        data = data.sort((a, b) => (a[this.sortColumn] < b[this.sortColumn] ? 1 : b[this.sortColumn] < a[this.sortColumn] ? -1 : 0));
      }
    }

    // Apply filters
    if (this.filter) {
      data = data.filter((d) => {
        for (const [key, filterValue] of Object.entries(this.filter)) {
          if (typeof filterValue === "object" && "operator" in filterValue) {
            const value = parseFloat(d[key]);
            const compareValue = parseFloat(filterValue.value);

            switch (filterValue.operator) {
              case "gt":
                if (!(value > compareValue)) return false;
                break;
              case "lt":
                if (!(value < compareValue)) return false;
                break;
              case "gte":
                if (!(value >= compareValue)) return false;
                break;
              case "lte":
                if (!(value <= compareValue)) return false;
                break;
              case "eq":
                if (value !== compareValue) return false;
                break;
            }
          } else {
            // only selected filter
            const filter = Object.entries(filterValue)
              .filter(([_k, v]) => v)
              .map(([k, _v]) => k);
            if (filter.length > 0) {
              const dataValues = Array.isArray(d[key]) ? d[key] : String(d[key]).split(/,\s*/);
              const hasMatch = dataValues.some((val) =>
                filter.some((f) => String(val).toLowerCase().trim() === String(f).toLowerCase().trim())
              );

              if (!hasMatch) {
                return false;
              }
            }
          }
        }
        return true;
      });
    }

    // Group rows if requested
    if (this.options && this.options.groupBy) {
      const groupBy = this.options.groupBy;
      const groupKey = typeof groupBy === "string" ? groupBy : groupBy.key;
      const groups = {};
      for (const row of data) {
        const key = row[groupKey];
        if (!(key in groups)) groups[key] = [];
        groups[key].push(row);
      }
      let aggregated = Object.values(groups).map((rows) => {
        if (typeof groupBy === "object" && typeof groupBy.aggregate === "function") {
          return groupBy.aggregate(rows);
        }
        // Default: use first row of the group
        return rows[0];
      });

      // Re-apply sorting on aggregated rows to respect current sort
      if (this.sortColumn) {
        if (this.sortDirection === "ASC") {
          aggregated = aggregated.sort((a, b) => (a[this.sortColumn] > b[this.sortColumn] ? 1 : b[this.sortColumn] > a[this.sortColumn] ? -1 : 0));
        } else {
          aggregated = aggregated.sort((a, b) => (a[this.sortColumn] < b[this.sortColumn] ? 1 : b[this.sortColumn] < a[this.sortColumn] ? -1 : 0));
        }
      }

      return aggregated;
    }

    return data;
  },
  sort(column) {
    if (this.sortColumn && this.sortColumn === column) {
      this.sortDirection = this.sortDirection === "ASC" ? "DESC" : "ASC";
    } else {
      this.sortDirection = "ASC";
    }
    this.sortColumn = column;
    this.paginationUpdate();
  },
  paginationPageChange(page) {
    this.currentPage = page;
    this.paginationUpdate();
  },
  paginationUpdate() {
    if (this.serverSidePagination) {
      this.$emit("paginationUpdate", {
        page: this.currentPage - 1,
        limit: this.limit,
        order: this.sortColumn ? [[this.sortColumn, this.sortDirection]] : null,
        filter: this.sequelizeFilter,
      });
    }
  },
  paginationItemsPerPageChange(value) {
    this.itemsPerPage = value;
    this.currentPage = 1;
    this.paginationUpdate();
  },
};
