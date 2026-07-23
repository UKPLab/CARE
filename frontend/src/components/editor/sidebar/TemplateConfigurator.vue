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
                          >
                            {{ optionDef.label }}
                          </option>
                        </select>
                        <input
                          v-if="row.name"
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
    getDuplicatePlaceholderIndexes,
    getNextPlaceholderIndex,
    isPositiveIntegerOptionValue,
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
          8: "Prompt",
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
      translateMaybeKey,
      hasPlaceholderOptions(placeholder) {
        return Array.isArray(placeholder.placeholderOptions) && placeholder.placeholderOptions.length > 0;
      },
      getPendingOptionRows(placeholderKey) {
        if (!this.pendingOptionRowsByKey[placeholderKey]) {
          this.pendingOptionRowsByKey[placeholderKey] = [];
        }
        return this.pendingOptionRowsByKey[placeholderKey];
      },
      addOptionRow(placeholderKey) {
        const rows = this.getPendingOptionRows(placeholderKey);
        rows.push({ name: "", value: "" });
      },
      removeOptionRow(placeholderKey, rowIndex) {
        const rows = this.getPendingOptionRows(placeholderKey);
        rows.splice(rowIndex, 1);
        this.optionApplyWarnings = [];
      },
      getOptionLabel(placeholder, optionName) {
        const optionDef = (placeholder.placeholderOptions || []).find((entry) => entry.name === optionName);
        return optionDef ? optionDef.label : optionName;
      },
      getOptionDef(placeholder, optionName) {
        return (placeholder.placeholderOptions || []).find((entry) => entry.name === optionName);
      },
      isValidOptionValue(optionDef, value) {
        if (!optionDef) {
          return false;
        }
        if (optionDef.valueType === "positiveInteger") {
          return isPositiveIntegerOptionValue(value);
        }
        return value !== undefined && value !== null && String(value).trim() !== "";
      },
      collectSelectedOptions(placeholder) {
        const rows = this.getPendingOptionRows(placeholder.id);
        const selectedOptions = {};
        const applyWarnings = [];

        rows.forEach((row) => {
          if (!row.name) {
            if (row.value !== "" && row.value != null) {
              applyWarnings.push("A value was entered but no option was selected, so it was not included.");
            }
            return;
          }
          const optionDef = this.getOptionDef(placeholder, row.name);
          if (!optionDef) {
            applyWarnings.push(`Unknown option for ${placeholder.label}, so it was not included.`);
            return;
          }
          if (!this.isValidOptionValue(optionDef, row.value)) {
            if (row.value === "" || row.value == null) {
              applyWarnings.push(`${optionDef.label} was not included (no value entered).`);
            } else {
              applyWarnings.push(`${optionDef.label} was not included (invalid value).`);
            }
            return;
          }
          selectedOptions[row.name] = String(row.value).trim();
        });

        return { selectedOptions, applyWarnings };
      },
      validateTokenOptions(parsed, tokenText) {
        const placeholderDef = this.placeholderDefsByKey[parsed.baseKey];
        const allowedOptions = placeholderDef?.placeholderOptions || [];
        const allowedByName = Object.fromEntries(
          allowedOptions.map((entry) => [entry.name, entry])
        );
        const errors = [];

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
      getPlaceholderHelp(placeholder) {
        const descriptionKey = placeholder.description;
        if (typeof descriptionKey === "string") {
          const helpKey = descriptionKey.replace(".descriptions.", ".help.");
          if (this.$te(helpKey)) {
            return this.$t(helpKey);
          }
        }

        const type = this.templateType;
        const key = placeholder.id;

        const longDescriptions = {
          1: { // Email - General
            username: "The username of the person receiving the email. For password reset, verification, or registration emails this is the user whose account the email is about.",
            firstName: "The first name of the person receiving the email.",
            lastName: "The last name of the person receiving the email.",
            link: "The URL included in the email (e.g. password reset, verification, or registration).",
          },
          2: { // Email - Study Session
            username: "The person receiving this email. For session start and session finish notifications this is always the submission owner.",
            link: "The URL to open the review (read-only). Used for session start and session finish.",
          },
          3: { // Email - Assignment
            username: "The username of the reviewer who is assigned to the task.",
            assignmentType: "How the work is assigned: \"document\" (review by document) or \"submission\" (review by submission).",
            assignmentName: "The name of the assignment or study the reviewer is assigned to.",
            link: "The URL for the reviewer to open and start their review session. They must use this link to begin the assigned task.",
          },
          6: { // Email - Study Close
            username: "The username of the session owner who had an open session when the study was closed.",
            studyName: "The name of the study that was closed.",
          },
          7: { // Email - Submission upload
            username: "The person receiving this email (assignment owner or submitter).",
            assignmentName: "The title of the assignment.",
            eventType: "Lowercase sentence text: \"uploaded\" or \"reuploaded\".",
            assignmentId: "Internal assignment ID.",
            submissionId: "Internal submission ID.",
            timestamp: "When the submission was uploaded.",
          },
          8: { // Prompt
            pdfText:
              "Add inserts ~pdfText[N]~ with the next index (gaps are kept after deletes). Map each index in the hook configuration. " +
              "Full text extracted from a PDF. Optional Character limit truncates retrieved text for that token only; leave it empty for the full extract.",
            editorText:
              "Add inserts ~editorText[N]~ with the next index (gaps are kept after deletes). Map each index in the hook configuration. " +
              "Latest plain text from an HTML/modal editor document (delta plus unsaved draft edits). " +
              "When resolving during step load in the same pass as NLP insertIntoEditor, pass context.editorText explicitly so the value matches what the user sees.",
            assessmentResult:
              "Add inserts ~assessmentResult[N]~ with the next index (gaps are kept after deletes). Map each index in the hook configuration. " +
              "Rubric saved in the Assessment sidebar (JSON: criterion → score and comment). " +
              "Empty when no assessment has been saved.",
            inlineComments:
              "Add inserts ~inlineComments[N]~ with the next index (gaps are kept after deletes). Map each index in the hook configuration. " +
              "Structured PDF annotator comments (page, quote, comment, tag). " +
              "Empty when there are no comments.",
            nlpAssessmentSuggestion:
              "Add inserts ~nlpAssessmentSuggestion[N]~ with the next index (gaps are kept after deletes). Map each index in the hook configuration. " +
              "Draft rubric from the NLP service (document_data), not the saved assessment_result. " +
              "Empty when NLP has not run or produced no draft.",
            previousAssessmentResult:
              "Add inserts ~previousAssessmentResult[N]~ with the next index (gaps are kept after deletes). Map each index in the hook configuration. " +
              "Saved assessment_result from a prior study step when carry-over is configured. Same JSON shape as Assessment result. " +
              "Empty when there is no prior step or carry-over is disabled.",
            assessmentConfiguration:
              "Add inserts ~assessmentConfiguration[N]~ with the next index (gaps are kept after deletes). Map each index in the hook configuration. " +
              "Assessment configuration JSON (rubrics, criteria, max points) from linked configuration or inline settings. " +
              "Use when the prompt needs the rubric definition, not filled scores.",
            submissionFiles:
              "Add inserts ~submissionFiles[N]~ with the next index (gaps are kept after deletes). Map each index in the hook configuration. " +
              "Text extracted from a mapped submission file (PDF, TeX, etc.).",
            studyContext:
              "Add inserts ~studyContext[N]~ with the next index (gaps are kept after deletes). Map each index in the hook configuration. " +
              "Study, step, and document metadata. " +
              "Useful for grounding prompts without embedding full document text.",
          },
        };

        return (longDescriptions[type] && longDescriptions[type][key]) || translateMaybeKey(descriptionKey);
      },
      initializePlaceholderCounts() {
        const counts = {};
        this.availablePlaceholders.forEach(placeholder => {
          counts[placeholder.id] = 0;
        });
        this.placeholderCounts = counts;
      },
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
          invalid.push(...this.validateTokenOptions(parsed, match[0]));
        }

        this.invalidPlaceholders = [...new Set(invalid)];
        this.duplicatePlaceholders = getDuplicatePlaceholderIndexes(editorContent)
          .filter((entry) => allowedKeys.has(entry.key))
          .map((entry) => formatDuplicatePlaceholderToken(entry));
      },
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
      getPlaceholderIcon(placeholderType) {
        const iconMap = {
          "user": "bi bi-person",
          "study_creator": "bi bi-person-badge",
          "link": "bi bi-link-45deg",
          "assignment": "bi bi-file-text",
        };
        return iconMap[placeholderType] || "bi bi-tag";
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
    max-width: 8rem;
  }
  </style>