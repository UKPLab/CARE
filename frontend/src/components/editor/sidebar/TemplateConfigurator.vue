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
                <div class="d-flex align-items-center">
                  <div class="icon-container p-2 text-primary me-2">
                    <i :class="placeholder.icon"></i>
                  </div>
                  <div class="d-flex flex-column">
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
                  </div>
                </div>
                <div class="d-flex align-items-center">
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
    parsePlaceholderMatch,
    PLACEHOLDER_TOKEN_REGEX,
  } from "@/components/editor/template/placeholderTokens.js";
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
      // Help lives only in templates.json. Lookup by type + placeholderKey
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
          }
        }

        this.invalidPlaceholders = [...new Set(invalid)];
        this.duplicatePlaceholders = getDuplicatePlaceholderIndexes(editorContent)
          .filter((entry) => allowedKeys.has(entry.key))
          .map((entry) => formatDuplicatePlaceholderToken(entry));
      },
      handlePlaceholderClick(placeholder) {
        const nextIndex = getNextPlaceholderIndex(this.lastEditorContent || "", placeholder.id);
        this.eventBus.emit("editorInsertText", {
          templateId: this.templateId,
          text: formatPlaceholderToken(placeholder.id, nextIndex),
        });
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
  </style>