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
        <strong>{{ $t("templates.placeholders.warning") }}</strong>
        {{ $t("templates.placeholders.duplicateBracketIds") }}
        <ul class="mb-0 mt-2">
          <li v-for="ph in duplicatePlaceholders" :key="ph">{{ ph }}</li>
        </ul>
        {{ $t("templates.placeholders.duplicateBracketIdsHelp") }}
      </div>

      <div v-if="optionApplyWarnings.length > 0" class="alert alert-warning mb-3">
        <strong>{{ $t("templates.placeholders.options.notice") }}</strong>
        {{ $t("templates.placeholders.options.notIncluded") }}
        <ul class="mb-0 mt-2">
          <li v-for="warning in optionApplyWarnings" :key="warning">{{ warning }}</li>
        </ul>
        {{ $t("templates.placeholders.options.notIncludedHelp") }}
      </div>

      <div class="card shadow mb-4 configurator">
        <div class="card-header bg-body">
          <h3 class="card-title fw-bold mb-0">{{ $t("sidebar.placeholders") }}</h3>
        </div>
        <div class="card-body p-0">
          <ul class="list-group list-group-flush">
            <TemplatePlaceholderCard
              v-for="placeholder in availablePlaceholders"
              :key="placeholder.id"
              :placeholder="placeholder"
              :count="placeholderCounts[placeholder.id] || 0"
              :template-type="templateType"
              @insert="handlePlaceholderClick"
              @clear-warnings="optionApplyWarnings = []"
            />
          </ul>
        </div>
      </div>
    </div>
  </template>

  <script>
  import TemplatePlaceholderCard from "./TemplatePlaceholderCard.vue";
  import { resolveApiMessage, translateMaybeKey } from "@/assets/utils";
  import {
    countPlaceholdersByKey,
    formatDuplicatePlaceholderToken,
    formatPlaceholderToken,
    getDuplicatePlaceholderIndexes,
    getDuplicateOptionNames,
    getNextPlaceholderIndex,
    isValidOptionValue,
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
      TemplatePlaceholderCard,
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

      /**
       * Pending option rows for a placeholder key (creates an empty list if none).
       *
       * @param {string} placeholderKey - Placeholder key (`placeholder.id`)
       * @returns {Array} Rows with `name`, `value`, `from`, `to`
       */

      /**
       * Append an empty option row for the placeholder.
       *
       * @param {string} placeholderKey - Placeholder key
       * @returns {void}
       */

      /**
       * Remove one pending option row and clear insert notices.
       *
       * @param {string} placeholderKey - Placeholder key
       * @param {number} rowIndex - Index in the pending-row list
       * @returns {void}
       */

      /**
       * Whether the named option uses From/To inputs (`valueType` is `positiveIntegerRange`).
       *
       * @param {Object} placeholder - Sidebar placeholder
       * @param {string} optionName - Option name
       * @returns {boolean}
       */

      /**
       * Whether this option name is already selected on another pending row.
       *
       * @param {Object} placeholder - Sidebar placeholder
       * @param {string} optionName - Option name
       * @param {number} currentRowIndex - Row that owns the dropdown
       * @returns {boolean}
       */

      /**
       * Display label for an option name, or the name if no definition exists.
       *
       * @param {Object} placeholder - Sidebar placeholder
       * @param {string} optionName - Option name
       * @returns {string}
       */

      /**
       * Option definition for `optionName` on this placeholder, or undefined.
       *
       * @param {Object} placeholder - Sidebar placeholder
       * @param {string} optionName - Option name
       * @returns {Object|undefined}
       */

      /**
       * Build the option map for insert from pending rows. Duplicate names keep the first row.
       *
       * @param {Object} placeholder - Sidebar placeholder
       * @returns {Object} `{ selectedOptions, applyWarnings }`
       */

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
          errors.push(this.$t("templates.placeholders.options.errors.duplicate", { token: tokenText, name }));
        }

        for (const [name, value] of Object.entries(parsed.options || {})) {
          const optionDef = allowedByName[name];
          if (!optionDef) {
            errors.push(this.$t("templates.placeholders.options.errors.unknown", { token: tokenText, name }));
            continue;
          }
          if (!isValidOptionValue(optionDef, value)) {
            errors.push(this.$t("templates.placeholders.options.errors.invalid", {
              token: tokenText,
              option: translateMaybeKey(optionDef.label),
            }));
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
      handlePlaceholderClick({placeholder, selectedOptions, applyWarnings}) {
        this.optionApplyWarnings = [...new Set(applyWarnings)];

        const nextIndex = getNextPlaceholderIndex(this.lastEditorContent || "", placeholder.id);
        const optionsToInsert = Object.keys(selectedOptions).length > 0 ? selectedOptions : undefined;
        this.eventBus.emit("editorInsertText", {
          templateId: this.templateId,
          text: formatPlaceholderToken(placeholder.id, nextIndex, optionsToInsert),
        });

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
    --bg-color: var(--bs-secondary-bg, rgb(219, 234, 254));
    --icon-container-size: 36px;
  }
</style>
