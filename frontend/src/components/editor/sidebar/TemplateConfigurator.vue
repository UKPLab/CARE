<template>
    <div>
      <!-- Warning banner for invalid placeholders -->
      <div v-if="invalidPlaceholders.length > 0" class="alert alert-warning mb-3">
        <strong>Warning:</strong> The following placeholders are not valid for {{ templateTypeName }} templates:
        <ul class="mb-0 mt-2">
          <li v-for="ph in invalidPlaceholders" :key="ph">~{{ ph }}~</li>
        </ul>
        These placeholders will be ignored when the template is used.
      </div>
  
      <div class="card shadow mb-4 configurator">
        <div class="card-header bg-white">
          <h3 class="card-title fw-bold mb-0">Placeholders</h3>
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
                  <div class="icon-container rounded p-2 text-primary">
                    <i :class="placeholder.icon"></i>
                  </div>
                  <div>
                    <h5 class="mb-1">{{ placeholder.label }}</h5>
                    <p class="text-muted small mb-0">{{ placeholder.description }}</p>
                  </div>
                </div>
                <div class="d-flex align-items-center">
                  <span class="badge rounded-pill me-2 text-primary">{{ placeholderCounts[placeholder.id] || 0 }}</span>
                  <button
                    class="btn btn-primary btn-sm d-flex align-items-center"
                    @click="handlePlaceholderClick(placeholder)"
                  >
                    <i class="bi bi-plus-lg me-1"></i> Add
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
    inject: {
      templateId: {
        type: Number,
        required: true,
        default: 0,
      },
    },
    data() {
      return {
        // Placeholder definitions for each template type
        placeholderConfigs: {
          1: { // Email
            placeholders: [
              { id: "name", text: "~name~", label: "Recipient Name", description: "Insert recipient's name", icon: "bi bi-person" },
              { id: "email", text: "~email~", label: "Email Address", description: "Insert email address", icon: "bi bi-envelope" },
              { id: "subject", text: "~subject~", label: "Subject", description: "Insert email subject", icon: "bi bi-tag" },
            ],
          },
          2: { // Study (Modal)
            placeholders: [
              { id: "text", text: "~text~", label: "Text placeholder", description: "Add text content blocks", icon: "bi bi-type" },
              { id: "chart", text: "~chart~", label: "Single chart", description: "Visualize data with a chart", icon: "bi bi-bar-chart" },
              { id: "comparison", text: "~comparison~", label: "Comparison chart", description: "Compare multiple data sets", icon: "bi bi-bar-chart-steps" },
            ],
          },
          3: { // Document
            placeholders: [
              { id: "title", text: "~title~", label: "Document Title", description: "Insert document title", icon: "bi bi-file-text" },
              { id: "author", text: "~author~", label: "Author Name", description: "Insert author name", icon: "bi bi-person" },
              { id: "date", text: "~date~", label: "Date", description: "Insert current date", icon: "bi bi-calendar" },
            ],
          },
        },
        placeholderCounts: {},
        invalidPlaceholders: [],
      };
    },
    computed: {
      template() {
        return this.$store.getters["table/template/get"](this.templateId);
      },
      templateType() {
        return this.template?.type || null;
      },
      templateTypeName() {
        if (!this.templateType) return "Unknown";
        const types = { 1: "Email", 2: "Study", 3: "Document" };
        return types[this.templateType] || "Unknown";
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
    },
    unmounted() {
      this.eventBus.off("editorContentUpdated", this.editorContentHandler);
    },
    methods: {
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