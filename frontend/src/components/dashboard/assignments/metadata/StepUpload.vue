<template>
  <div class="p-3">
    <p class="text-muted mb-3">
      {{ $t('assignments.metadata.upload.help') }}
    </p>
    <input
      ref="metadataFileInput"
      type="file"
      class="form-control"
      accept=".json,.csv,application/json,text/csv"
      @change="handleFileChange"
    />
    <div v-if="fileName" class="mt-2 small">
      {{ $t('assignments.metadata.upload.loadedFile') }}
      <strong>{{ fileName }}</strong>
    </div>
    <div v-if="parseError" class="mt-2 text-danger small">
      {{ parseError }}
    </div>
    <div v-if="rows.length > 0" class="mt-2 small text-success">
      {{ $t('assignments.metadata.upload.parsedSummary', { rows: rows.length, fields: sourceFields.length }) }}
    </div>
  </div>
</template>

<script>
import Papa from "papaparse";

/**
 * First step of the metadata import flow: upload and parse a JSON or CSV file.
 *
 * @author Linyin Huang
 */
export default {
  name: "StepUpload",
  props: {
    rows: {
      type: Array,
      default: () => [],
    },
    sourceFields: {
      type: Array,
      default: () => [],
    },
    fileName: {
      type: String,
      default: "",
    },
    parseError: {
      type: String,
      default: "",
    },
  },
  emits: [
    "update:rows",
    "update:sourceFields",
    "update:fileName",
    "update:parseError",
    "parsed",
    "parse-failed",
  ],
  methods: {
    /**
     * Recursively flatten nested JSON structures into a single array of row objects.
     *
     * This allows the metadata import to accept exports where rows may be wrapped
     * in one or more array layers, such as `[[{ id: "1" }, { id: "2" }]]`.
     * Non-object primitive values are ignored.
     *
     * @param {*} payload - Parsed JSON content that may contain nested arrays and objects.
     * @returns {Object[]} A flat array containing only row-like objects.
     *
     * @example
     * // Input: [[{ id: "1" }, { id: "2" }]]
     * // Output: [{ id: "1" }, { id: "2" }]
     * const flatRows = this.flattenRows(payload);
     */
    flattenRows(payload) {
      if (Array.isArray(payload)) {
        return payload.flatMap((entry) => this.flattenRows(entry));
      }

      if (payload && typeof payload === "object") {
        return [payload];
      }

      return [];
    },
    async parseJson(file) {
      const text = await file.text();
      const payload = JSON.parse(text);
      const rows = this.flattenRows(payload).filter(
        (row) => row && typeof row === "object",
      );
      const fields = [
        ...rows.reduce((acc, row) => {
          Object.keys(row).forEach((key) => acc.add(key));
          return acc;
        }, new Set()),
      ];
      return {
        rows,
        fields,
      };
    },
    parseCsv(file) {
      return new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: ({ data, meta, errors }) => {
            if (Array.isArray(errors) && errors.length > 0) {
              const summarizedErrors = errors
                .slice(0, 3)
                .map((entry) => {
                  const rowInfo = Number.isInteger(entry?.row)
                    ? this.$t("assignments.metadata.upload.errors.csvRow", { row: entry.row + 1 })
                    : this.$t("assignments.metadata.upload.errors.csvUnknownRow");
                  return `${rowInfo}: ${entry?.message || this.$t("assignments.metadata.upload.errors.csvMalformed")}`;
                })
                .join(" | ");
              reject(new Error(this.$t("assignments.metadata.upload.errors.csvFailed", { details: summarizedErrors })));
              return;
            }
            resolve({
              rows: data.filter((row) => row && typeof row === "object"),
              fields: meta.fields || [],
            });
          },
          error: reject,
        });
      });
    },
    clearParsedState() {
      this.$emit("update:rows", []);
      this.$emit("update:sourceFields", []);
    },
    async handleFileChange(event) {
      const file = event.target.files?.[0];
      if (!file) return;

      this.$emit("update:fileName", file.name);
      this.$emit("update:parseError", "");

      try {
        let parsed = {
          rows: [],
          fields: [],
        };
        if (file.name.toLowerCase().endsWith(".json")) {
          parsed = await this.parseJson(file);
        } else if (file.name.toLowerCase().endsWith(".csv")) {
          parsed = await this.parseCsv(file);
        } else {
          throw new Error(this.$t("assignments.metadata.upload.errors.unsupportedFormat"));
        }

        const fields = parsed.fields
          .map((field) => String(field || "").trim())
          .filter(Boolean);
        if (parsed.rows.length === 0) {
          throw new Error(this.$t("assignments.metadata.upload.errors.noUsableRows"));
        }
        if (fields.length === 0) {
          throw new Error(this.$t("assignments.metadata.upload.errors.noUsableFields"));
        }

        this.$emit("update:rows", parsed.rows);
        this.$emit("update:sourceFields", fields);
        this.$emit("parsed");
      } catch (error) {
        this.clearParsedState();
        this.$emit(
          "update:parseError",
          error.message || this.$t("assignments.metadata.upload.errors.parseFailed"),
        );
        this.$emit("parse-failed");
      }
    },
  },
};
</script>
