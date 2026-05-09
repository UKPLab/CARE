<template>
    <div>
      <!-- Warning banner for invalid placeholders -->
      <div v-if="invalidPlaceholders.length > 0" class="alert alert-warning mb-3">
        <strong>{{ $t("templates.placeholders.warning") }}</strong>
        {{ $t("templates.placeholders.invalidPlaceholdersMessage", { templateType: templateTypeName }) }}
        <ul class="mb-0 mt-2">
          <li v-for="ph in invalidPlaceholders" :key="ph">~{{ ph }}~</li>
        </ul>
        {{ $t("templates.placeholders.invalidPlaceholdersIgnored") }}
      </div>
  
      <div class="card shadow mb-4 configurator">
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
                      <h5 class="mb-0 me-1">{{ placeholder.label }}<span v-if="placeholder.required" class="text-danger ms-1">*</span></h5>
                      <FormHelp
                        v-if="placeholder.description"
                        :help="getPlaceholderHelp(placeholder)"
                      />
                    </div>
                    <p
                      v-if="placeholder.description"
                      class="mb-0 text-muted"
                    >
                      {{ placeholder.description }}
                    </p>
                  </div>
                </div>
                <div class="d-flex align-items-center">
                  <span class="badge rounded-pill me-2 text-primary">{{ placeholderCounts[placeholder.id] || 0 }}</span>
                  <button
                    class="btn btn-primary btn-sm d-flex align-items-center"
                    @click="handlePlaceholderClick(placeholder)"
                  >
                    <i class="bi bi-plus-lg me-1"></i> {{ $t("common.add") }}
                  </button>
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
  import { resolveApiMessage } from "@/assets/utils";
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
        },
        placeholderCounts: {},
        invalidPlaceholders: [],
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
        };
        return types[this.templateType] || this.$t("common.unknown");
      },
      availablePlaceholders() {
        if (!this.templateType || !this.placeholderConfigs[this.templateType]) {
          return [];
        }
        return this.placeholderConfigs[this.templateType].placeholders;
      },
      allowedPlaceholderTexts() {
        if (!this.availablePlaceholders) return [];
        return this.availablePlaceholders.map(p => p.text);
      },
    },
    mounted() {
      // Initialize placeholder counts
      this.initializePlaceholderCounts();
      
      // Listen for editor content updates
      this.editorContentHandler = (data) => {
        if (data.templateId === this.templateId) {
          this.updatePlaceholderCounts(data.content);
          this.validatePlaceholders(data.content);
        }
      };
      this.eventBus.on("editorContentUpdated", this.editorContentHandler);

      if (this.templateId && this.templateId > 0) {
        this.$socket.emit("templatePlaceholderGetAll", { templateId: this.templateId }, (result) => {
          if (result.success){
            // Always update placeholders from backend (even if empty array for document types)
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
      getPlaceholderHelp(placeholder) {
        const type = this.templateType;
        const key = placeholder.id;

        const longDescriptions = {
          1: { // Email - General
            username: this.$t("templates.placeholders.help.emailGeneral.username"),
            firstName: this.$t("templates.placeholders.help.emailGeneral.firstName"),
            lastName: this.$t("templates.placeholders.help.emailGeneral.lastName"),
            link: this.$t("templates.placeholders.help.emailGeneral.link"),
          },
          2: { // Email - Study Session
            username: this.$t("templates.placeholders.help.emailStudySession.username"),
            link: this.$t("templates.placeholders.help.emailStudySession.link"),
          },
          3: { // Email - Assignment
            username: this.$t("templates.placeholders.help.emailAssignment.username"),
            assignmentType: this.$t("templates.placeholders.help.emailAssignment.assignmentType"),
            assignmentName: this.$t("templates.placeholders.help.emailAssignment.assignmentName"),
            link: this.$t("templates.placeholders.help.emailAssignment.link"),
          },
          6: { // Email - Study Close
            username: this.$t("templates.placeholders.help.emailStudyClose.username"),
            studyName: this.$t("templates.placeholders.help.emailStudyClose.studyName"),
          },
        };

        return (longDescriptions[type] && longDescriptions[type][key]) || placeholder.description;
      },
      initializePlaceholderCounts() {
        const counts = {};
        this.availablePlaceholders.forEach(placeholder => {
          counts[placeholder.id] = 0;
        });
        this.placeholderCounts = counts;
      },
      updatePlaceholderCounts(editorContent) {
        // Reset counts
        this.initializePlaceholderCounts();
  
        // Count placeholders in the content
        if (editorContent && this.availablePlaceholders) {
          this.availablePlaceholders.forEach(placeholder => {
            const regex = new RegExp(this.escapeRegex(placeholder.text), 'g');
            const matches = editorContent.match(regex);
            if (matches) {
              this.placeholderCounts[placeholder.id] = matches.length;
            }
          });
        }
      },
      validatePlaceholders(editorContent) {
        if (!editorContent || !this.templateType) {
          this.invalidPlaceholders = [];
          return;
        }
  
        // Extract all placeholders from content using regex
        const placeholderRegex = /~([^~]+)~/g;
        const foundPlaceholders = [];
        let match;
        
        while ((match = placeholderRegex.exec(editorContent)) !== null) {
          foundPlaceholders.push(match[1]);
        }
  
        // Find invalid placeholders (not in allowed list)
        const invalid = foundPlaceholders.filter(ph => {
          const placeholderText = `~${ph}~`;
          return !this.allowedPlaceholderTexts.includes(placeholderText);
        });
  
        // Remove duplicates
        this.invalidPlaceholders = [...new Set(invalid)];
      },
      escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      },
      handlePlaceholderClick(placeholder) {
        this.eventBus.emit("editorInsertText", {
          templateId: this.templateId,
          text: placeholder.text,
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