<template>
    <div>
      <!-- Warning banner for invalid placeholders -->
      <div v-if="invalidPlaceholders.length > 0" class="alert alert-warning mb-3">
        <strong>{{ $t("templates.placeholders.warning") }}</strong>
        {{ $t("templates.placeholders.invalidPlaceholdersMessage", { templateType: templateTypeName }) }}
        <ul class="mb-0 mt-2">
          <li v-for="ph in invalidPlaceholders" :key="ph">{{ ph }}</li>
        </ul>
        {{ $t("templates.placeholders.invalidPlaceholdersIgnored") }}
      </div>

      <div v-if="duplicatePlaceholders.length > 0" class="alert alert-warning mb-3">
        <strong>Warning:</strong> The same bracket id appears more than once (e.g. two ~link[2]~):
        <ul class="mb-0 mt-2">
          <li v-for="ph in duplicatePlaceholders" :key="ph">{{ ph }}</li>
        </ul>
        Each ~key[N]~ id must be unique. Legacy ~key~ tokens without [N] are not checked here and can still repeat in older email templates. Saving is blocked until bracket duplicates are removed.
      </div>

      <div v-if="optionApplyWarnings.length > 0" class="alert alert-warning mb-3">
        <strong>Notice:</strong> The placeholder was added, but these options were not included:
        <ul class="mb-0 mt-2">
          <li v-for="warning in optionApplyWarnings" :key="warning">{{ warning }}</li>
        </ul>
        Fix the option row and insert another placeholder if you want that option in the template.
      </div>
  
      <div class="card shadow mb-0 configurator">
        <div class="card-header bg-white">
          <h3 class="card-title fw-bold mb-0">{{ $t("sidebar.placeholders") }}</h3>
        </div>
        <div class="card-body p-0">
          <ul class="list-group list-group-flush">
            <li
              v-for="placeholder in availablePlaceholders"
              :key="placeholder.id"
              class="list-group-item"
            >
              <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center flex-grow-1">
                  <div class="icon-container p-2 text-primary me-2">
                    <i :class="placeholder.icon"></i>
                  </div>
                  <div class="d-flex flex-column flex-grow-1">
                    <div class="d-flex align-items-center">
                      <h5 class="mb-0 me-1">{{ translateMaybeKey(placeholder.label) }}<span v-if="placeholder.required" class="text-danger ms-1">*</span></h5>
                      <FormHelp
                        v-if="placeholder.description"
                        :help="getPlaceholderHelp(placeholder)"
                      />
                    </div>
                    <p
                      v-if="placeholder.description"
                      class="mb-0 text-muted"
                    >
                      {{ translateMaybeKey(placeholder.description) }}
                    </p>
                    <div
                      v-if="hasPlaceholderOptions(placeholder)"
                      class="mt-2"
                    >
                      <div
                        v-for="(row, rowIndex) in getPendingOptionRows(placeholder.id)"
                        :key="`${placeholder.id}-option-${rowIndex}`"
                        class="d-flex align-items-center gap-2 mb-2"
                      >
                        <select
                          v-model="row.name"
                          class="form-select form-select-sm option-select"
                        >
                          <option value="">Select option...</option>
                          <option
                            v-for="optionDef in placeholder.placeholderOptions"
                            :key="optionDef.name"
                            :value="optionDef.name"
                            :disabled="isOptionDisabled(placeholder, optionDef.name, rowIndex)"
                          >
                            {{ optionDef.label }}
                          </option>
                        </select>
                        <template v-if="isRangeOption(placeholder, row.name)">
                          <input
                            v-model="row.from"
                            type="number"
                            min="1"
                            class="form-control form-control-sm option-input"
                            placeholder="From"
                          >
                          <span class="text-muted">–</span>
                          <input
                            v-model="row.to"
                            type="number"
                            min="1"
                            class="form-control form-control-sm option-input"
                            placeholder="To"
                          >
                        </template>
                        <input
                          v-else-if="row.name"
                          v-model="row.value"
                          type="number"
                          min="1"
                          class="form-control form-control-sm option-input"
                          :placeholder="getOptionLabel(placeholder, row.name)"
                        >
                        <BasicButton
                          class="btn btn-outline-secondary btn-sm"
                          icon="dash-lg"
                          text=""
                          @click="removeOptionRow(placeholder.id, rowIndex)"
                        />
                      </div>
                      <BasicButton
                        class="btn btn-outline-primary btn-sm"
                        icon="plus-lg"
                        text="Add option"
                        @click="addOptionRow(placeholder.id)"
                      />
                    </div>
                  </div>
                </div>
                <div class="d-flex align-items-center ms-2">
                  <span class="badge rounded-pill me-2 text-primary">{{ placeholderCounts[placeholder.id] || 0 }}</span>
                  <BasicButton
                    class="btn btn-primary btn-sm d-flex align-items-center"
                    icon="plus-lg"
                    :text="$t('common.add')"
                    @click="handlePlaceholderClick(placeholder)"
                  />
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </template>
  
  <script>
  import FormHelp from "@/basic/form/Help.vue";
  import { resolveApiMessage, translateMaybeKey } from "@/assets/utils";
  import BasicButton from "@/basic/Button.vue";
  import {
    countPlaceholdersByKey,
    formatDuplicatePlaceholderToken,
    formatPlaceholderToken,
    formatPositiveIntegerRange,
    getDuplicatePlaceholderIndexes,
    getDuplicateOptionNames,
    getNextPlaceholderIndex,
    isPositiveIntegerOptionValue,
    isPositiveIntegerRangeOptionValue,
    parsePlaceholderMatch,
    PLACEHOLDER_TOKEN_REGEX,
  } from "placeholder-tokens";
  /**
   * Template Configurator sidebar component
   *
   * Shows available placeholders based on template type and allows inserting them into the editor.
   * Validates placeholders against allowed list for the template type.
   *
   * @author Mohammad Elwan
   */
  export default {
    name: "TemplateConfigurator",
    components: {
      FormHelp,
      BasicButton,
    },
    inject: {
      templateId: {
        type: Number,
        required: true,
        default: 0,
      },
    },
    data() {
      return {
        // Placeholder definitions are fetched from backend (single source of truth)
        // Initialize with empty arrays - will be populated from database
        placeholderConfigs: {
          1: { placeholders: [] }, // Email - General
          2: { placeholders: [] }, // Email - Study Session
          3: { placeholders: [] }, // Email - Assignment
          4: { placeholders: [] }, // Document - General (no placeholders)
          5: { placeholders: [] }, // Document - Study (no placeholders)
          6: { placeholders: [] }, // Email - Study Close
          7: { placeholders: [] }, // Email - Submission upload
          8: { placeholders: [] }, // Prompt
        },
        placeholderCounts: {},
        invalidPlaceholders: [],
        duplicatePlaceholders: [],
        optionApplyWarnings: [],
        pendingOptionRowsByKey: {},
        lastEditorContent: "",
      };
    },
    computed: {
      template() {
        return this.$store.getters["table/template/get"](Number(this.templateId));
      },
      templateType() {
        return this.template?.type || null;
      },
      templateTypeName() {
        if (!this.templateType) return this.$t("common.unknown");
        const types = {
          1: this.$t("templates.types.emailGeneral"),
          2: this.$t("templates.types.emailStudySession"),
          3: this.$t("templates.types.emailAssignment"),
          4: this.$t("templates.types.documentGeneral"),
          5: this.$t("templates.types.documentStudy"),
          6: this.$t("templates.types.emailStudyClose"),
          7: this.$t("templates.types.emailSubmissionUpload"),
          8: this.$t("templates.types.prompt"),
        };
        return types[this.templateType] || this.$t("common.unknown");
      },
      availablePlaceholders() {
        if (!this.templateType || !this.placeholderConfigs[this.templateType]) {
          return [];
        }
        return this.placeholderConfigs[this.templateType].placeholders;
      },
      allowedPlaceholderKeys() {
        if (!this.availablePlaceholders) return [];
        return this.availablePlaceholders.map((p) => p.id);
      },
      placeholderCountOptions() {
        return { bracketOnly: this.templateType === 8 };
      },
      placeholderDefsByKey() {
        return Object.fromEntries(
          this.availablePlaceholders.map((placeholder) => [placeholder.id, placeholder])
        );
      },
    },
    mounted() {
      // Initialize placeholder counts
      this.initializePlaceholderCounts();
      
      // Listen for editor content updates
      this.editorContentHandler = (data) => {
        if (data.templateId === this.templateId) {
          this.lastEditorContent = data.content || "";
          this.updatePlaceholderCounts(data.content);
          this.validatePlaceholders(data.content);
        }
      };
      this.eventBus.on("editorContentUpdated", this.editorContentHandler);

      if (this.templateId && this.templateId > 0) {
        this.$socket.emit("templatePlaceholderGetAll", { templateId: this.templateId }, (result) => {
          if (result.success){
            const fetchedPlaceholders = (result.data || []).map(ph => ({
              id: ph.placeholderKey,
              text: `~${ph.placeholderKey}~`,
              label: ph.placeholderLabel,
              description: ph.placeholderDescription || ph.placeholderLabel,
              icon: this.getPlaceholderIcon(ph.placeholderType),
              required: ph.required === true,
              placeholderOptions: Array.isArray(ph.placeholderOptions) ? ph.placeholderOptions : [],
            }));
            
            if (this.templateType && this.placeholderConfigs[this.templateType]) {
              this.placeholderConfigs[this.templateType].placeholders = fetchedPlaceholders;
              this.initializePlaceholderCounts();
            }
          } else {
            this.eventBus.emit("toast", {
              title: this.$t("templates.placeholders.failedToLoad"),
              message: resolveApiMessage(result),
              variant: "danger",
            });
          }
        });
      }

    },
    unmounted() {
      this.eventBus.off("editorContentUpdated", this.editorContentHandler);
    },
    methods: {
      /**
       * Whether this placeholder has a non-empty `placeholderOptions` list from the database.
       *
       * @param {Object} placeholder - Sidebar placeholder
       * @returns {boolean}
       */
      hasPlaceholderOptions(placeholder) {
        return Array.isArray(placeholder.placeholderOptions) && placeholder.placeholderOptions.length > 0;
      },
      /**
       * Pending option rows for a placeholder key (creates an empty list if none).
       *
       * @param {string} placeholderKey - Placeholder key (`placeholder.id`)
       * @returns {Array} Rows with `name`, `value`, `from`, `to`
       */
      getPendingOptionRows(placeholderKey) {
        if (!this.pendingOptionRowsByKey[placeholderKey]) {
          this.pendingOptionRowsByKey[placeholderKey] = [];
        }
        return this.pendingOptionRowsByKey[placeholderKey];
      },
      /**
       * Append an empty option row for the placeholder.
       *
       * @param {string} placeholderKey - Placeholder key
       * @returns {void}
       */
      addOptionRow(placeholderKey) {
        const rows = this.getPendingOptionRows(placeholderKey);
        rows.push({ name: "", value: "", from: "", to: "" });
      },
      /**
       * Remove one pending option row and clear insert notices.
       *
       * @param {string} placeholderKey - Placeholder key
       * @param {number} rowIndex - Index in the pending-row list
       * @returns {void}
       */
      removeOptionRow(placeholderKey, rowIndex) {
        const rows = this.getPendingOptionRows(placeholderKey);
        rows.splice(rowIndex, 1);
        this.optionApplyWarnings = [];
      },
      /**
       * Whether the named option uses From/To inputs (`valueType` is `positiveIntegerRange`).
       *
       * @param {Object} placeholder - Sidebar placeholder
       * @param {string} optionName - Option name
       * @returns {boolean}
       */
      isRangeOption(placeholder, optionName) {
        const optionDef = this.getOptionDef(placeholder, optionName);
        return optionDef?.valueType === "positiveIntegerRange";
      },
      /**
       * Whether this option name is already selected on another pending row.
       *
       * @param {Object} placeholder - Sidebar placeholder
       * @param {string} optionName - Option name
       * @param {number} currentRowIndex - Row that owns the dropdown
       * @returns {boolean}
       */
      isOptionDisabled(placeholder, optionName, currentRowIndex) {
        const rows = this.getPendingOptionRows(placeholder.id);
        return rows.some((row, index) => index !== currentRowIndex && row.name === optionName);
      },
      /**
       * Display label for an option name, or the name if no definition exists.
       *
       * @param {Object} placeholder - Sidebar placeholder
       * @param {string} optionName - Option name
       * @returns {string}
       */
      getOptionLabel(placeholder, optionName) {
        const optionDef = (placeholder.placeholderOptions || []).find((entry) => entry.name === optionName);
        return optionDef ? optionDef.label : optionName;
      },
      /**
       * Option definition for `optionName` on this placeholder, or undefined.
       *
       * @param {Object} placeholder - Sidebar placeholder
       * @param {string} optionName - Option name
       * @returns {Object|undefined}
       */
      getOptionDef(placeholder, optionName) {
        return (placeholder.placeholderOptions || []).find((entry) => entry.name === optionName);
      },
      /**
       * Whether `value` matches the option's `valueType`.
       *
       * @param {Object} optionDef - Option definition
       * @param {string} value - Formatted option value
       * @returns {boolean}
       */
      isValidOptionValue(optionDef, value) {
        if (!optionDef) {
          return false;
        }
        if (optionDef.valueType === "positiveInteger") {
          return isPositiveIntegerOptionValue(value);
        }
        if (optionDef.valueType === "positiveIntegerRange") {
          return isPositiveIntegerRangeOptionValue(value);
        }
        return value !== undefined && value !== null && String(value).trim() !== "";
      },
      /**
       * Build the option map for insert from pending rows. Duplicate names keep the first row.
       *
       * @param {Object} placeholder - Sidebar placeholder
       * @returns {Object} `{ selectedOptions, applyWarnings }`
       */
      collectSelectedOptions(placeholder) {
        const rows = this.getPendingOptionRows(placeholder.id);
        const selectedOptions = {};
        const applyWarnings = [];

        rows.forEach((row) => {
          if (!row.name) {
            if (
              (row.value !== "" && row.value != null)
              || (row.from !== "" && row.from != null)
              || (row.to !== "" && row.to != null)
            ) {
              applyWarnings.push("A value was entered but no option was selected, so it was not included.");
            }
            return;
          }
          const optionDef = this.getOptionDef(placeholder, row.name);
          if (!optionDef) {
            applyWarnings.push(`Unknown option for ${placeholder.label}, so it was not included.`);
            return;
          }
          const optionValue = optionDef.valueType === "positiveIntegerRange"
            ? formatPositiveIntegerRange(row.from, row.to)
            : (row.value === undefined || row.value === null ? "" : String(row.value).trim());
          if (!this.isValidOptionValue(optionDef, optionValue)) {
            if (!optionValue) {
              applyWarnings.push(`${optionDef.label} was not included (no value entered).`);
            } else {
              applyWarnings.push(`${optionDef.label} was not included (invalid value).`);
            }
            return;
          }
          if (Object.prototype.hasOwnProperty.call(selectedOptions, row.name)) {
            applyWarnings.push(`${optionDef.label} was already set, so the later row was not included.`);
            return;
          }
          selectedOptions[row.name] = optionValue;
        });

        return { selectedOptions, applyWarnings };
      },
      /**
       * Validate option names and values on a parsed token (including typed duplicates).
       *
       * @param {Object} parsed - Result of parsePlaceholderMatch
       * @param {string} tokenText - Full token string for error text
       * @param {string} [optionsStr] - Raw text inside `{...}`
       * @returns {string[]} Error strings
       */
      validateTokenOptions(parsed, tokenText, optionsStr) {
        const placeholderDef = this.placeholderDefsByKey[parsed.baseKey];
        const allowedOptions = placeholderDef?.placeholderOptions || [];
        const allowedByName = Object.fromEntries(
          allowedOptions.map((entry) => [entry.name, entry])
        );
        const errors = [];

        for (const name of getDuplicateOptionNames(optionsStr)) {
          errors.push(`${tokenText} (duplicate option "${name}")`);
        }

        for (const [name, value] of Object.entries(parsed.options || {})) {
          const optionDef = allowedByName[name];
          if (!optionDef) {
            errors.push(`${tokenText} (unknown option "${name}")`);
            continue;
          }
          if (!this.isValidOptionValue(optionDef, value)) {
            errors.push(`${tokenText} (invalid ${optionDef.label.toLowerCase()})`);
          }
        }

        return errors;
      },
      translateMaybeKey,
      /**
       * Tooltip from templates.json (`templates.placeholders.help.<typeSlug>.<key>`), or translated description.
       *
       * @param {Object} placeholder - Sidebar placeholder
       * @returns {string}
       */
      getPlaceholderHelp(placeholder) {
        const typeSlug = {
          1: "emailGeneral",
          2: "emailStudySession",
          3: "emailAssignment",
          6: "emailStudyClose",
          7: "emailSubmissionUpload",
          8: "prompt",
        }[this.templateType];
        if (typeSlug && placeholder.id) {
          const helpKey = `templates.placeholders.help.${typeSlug}.${placeholder.id}`;
          if (this.$te(helpKey)) {
            return this.$t(helpKey);
          }
        }
        return translateMaybeKey(placeholder.description);
      },
      /**
       * Reset per-placeholder insert counts to 0.
       *
       * @returns {void}
       */
      initializePlaceholderCounts() {
        const counts = {};
        this.availablePlaceholders.forEach(placeholder => {
          counts[placeholder.id] = 0;
        });
        this.placeholderCounts = counts;
      },
      /**
       * Count `~key[N]~` (and unbracketed `~key~` except on type 8) in editor content.
       *
       * @param {string} editorContent - Current template editor text
       * @returns {void}
       */
      updatePlaceholderCounts(editorContent) {
        this.initializePlaceholderCounts();

        if (!editorContent || !this.availablePlaceholders) {
          return;
        }

        const countsByKey = countPlaceholdersByKey(editorContent, this.placeholderCountOptions);
        this.availablePlaceholders.forEach((placeholder) => {
          this.placeholderCounts[placeholder.id] = countsByKey[placeholder.id] || 0;
        });
      },
      /**
       * Mark unknown keys, type-8 tokens without `[N]`, bad option values, and duplicate option names.
       * Also lists duplicate `~key[N]~` ids in `duplicatePlaceholders`.
       *
       * @param {string} editorContent - Current template editor text
       * @returns {void}
       */
      validatePlaceholders(editorContent) {
        if (!editorContent || !this.templateType) {
          this.invalidPlaceholders = [];
          this.duplicatePlaceholders = [];
          return;
        }

        const allowedKeys = new Set(this.allowedPlaceholderKeys);
        const invalid = [];
        const regex = new RegExp(PLACEHOLDER_TOKEN_REGEX.source, "g");
        let match;

        while ((match = regex.exec(editorContent)) !== null) {
          const parsed = parsePlaceholderMatch(match);
          if (!parsed.baseKey) {
            continue;
          }
          if (this.templateType === 8 && parsed.index == null) {
            invalid.push(`~${parsed.baseKey}~`);
            continue;
          }
          if (!allowedKeys.has(parsed.baseKey)) {
            invalid.push(match[0]);
            continue;
          }
          invalid.push(...this.validateTokenOptions(parsed, match[0], match[3]));
        }

        this.invalidPlaceholders = [...new Set(invalid)];
        this.duplicatePlaceholders = getDuplicatePlaceholderIndexes(editorContent)
          .filter((entry) => allowedKeys.has(entry.key))
          .map((entry) => formatDuplicatePlaceholderToken(entry));
      },
      /**
       * Insert `~key[N]{options}~` at the next index and clear pending option rows.
       *
       * @param {Object} placeholder - Sidebar placeholder
       * @returns {void}
       */
      handlePlaceholderClick(placeholder) {
        const { selectedOptions, applyWarnings } = this.collectSelectedOptions(placeholder);
        this.optionApplyWarnings = [...new Set(applyWarnings)];

        const nextIndex = getNextPlaceholderIndex(this.lastEditorContent || "", placeholder.id);
        const optionsToInsert = Object.keys(selectedOptions).length > 0 ? selectedOptions : undefined;
        this.eventBus.emit("editorInsertText", {
          templateId: this.templateId,
          text: formatPlaceholderToken(placeholder.id, nextIndex, optionsToInsert),
        });

        if (this.hasPlaceholderOptions(placeholder)) {
          this.pendingOptionRowsByKey[placeholder.id] = [];
        }
      },
      /**
       * Sidebar icon for a placeholder row. Seeded types are `link` and `text`;
       * only `link` has a dedicated icon, the rest use `bi-tag`.
       *
       * @param {string} placeholderType - Type from the placeholder row
       * @returns {string}
       */
      getPlaceholderIcon(placeholderType) {
        return placeholderType === "link" ? "bi bi-link-45deg" : "bi bi-tag";
      },
    },
  };
  </script>
  
  <style scoped>
  .configurator {
    --bg-color: rgb(219, 234, 254);
    --icon-container-size: 36px;
  }
  
  .list-group-item {
    padding: 0.825rem;
  }

  .list-group-item:last-child {
    padding-bottom: 1.5rem;
  }
  
  .icon-container {
    width: var(--icon-container-size);
    height: var(--icon-container-size);
    display: flex;
    margin-right: 0.625rem;
    align-items: center;
    justify-content: center;
    color: var(--text-color);
    background-color: var(--bg-color);
  }
  
  .list-group-item:hover {
    background-color: #f8f9fa;
  }
  
  .badge {
    background-color: var(--bg-color);
  }

  .option-select {
    max-width: 11rem;
  }

  .option-input {
    max-width: 5.5rem;
  }
  </style>