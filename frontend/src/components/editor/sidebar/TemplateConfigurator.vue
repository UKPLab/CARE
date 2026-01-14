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
        // Email templates (1, 2, 3) are admin-only
        // Document templates (4, 5) have no placeholders
        placeholderConfigs: {
          1: { // Email - General (admin only)
            placeholders: [
              { id: "username", text: "~username~", label: "Username", description: "Recipient's login username", icon: "bi bi-person" },
              { id: "firstName", text: "~firstName~", label: "First Name", description: "Recipient's first name as registered", icon: "bi bi-person" },
              { id: "lastName", text: "~lastName~", label: "Last Name", description: "Recipient's last name as registered", icon: "bi bi-person" },
              { id: "link", text: "~link~", label: "Link", description: "Action link (e.g., verification or password reset URL)", icon: "bi bi-link-45deg" },
            ],
          },
          2: { // Email - Study Session (admin only)
            placeholders: [
              { id: "username", text: "~username~", label: "Participant Username", description: "Study participant's login username", icon: "bi bi-person" },
              { id: "creatorUsername", text: "~creatorUsername~", label: "Creator Username", description: "Study creator's login username", icon: "bi bi-person-badge" },
              { id: "link", text: "~link~", label: "Session Link", description: "Link to the read-only study session view", icon: "bi bi-link-45deg" },
            ],
          },
          3: { // Email - Assignment (admin only)
            placeholders: [
              { id: "username", text: "~username~", label: "Username", description: "Assigned participant's login username", icon: "bi bi-person" },
              { id: "assignmentType", text: "~assignmentType~", label: "Assignment Type", description: "Type of assignment: 'document' or 'submission'", icon: "bi bi-file-text" },
              { id: "assignmentName", text: "~assignmentName~", label: "Assignment Name", description: "Name of the assigned document or submission", icon: "bi bi-file-text" },
              { id: "link", text: "~link~", label: "Assignment Link", description: "Direct link to access the assignment", icon: "bi bi-link-45deg" },
            ],
          },
          4: { // Document - General - NO placeholders
            placeholders: [],
          },
          5: { // Document - Study - NO placeholders
            placeholders: [],
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
        const types = { 1: "Email - General", 2: "Email - Study Session", 3: "Email - Assignment", 4: "Document - General", 5: "Document - Study" };
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

      if (this.templateId && this.templateId > 0) {
        this.$socket.emit("templatePlaceholderGetAll", { templateId: this.templateId }, (result) => {
          if (result.success){
            if (result.data && result.data.length > 0) {

              const fetchedPlaceholders = result.data.map(ph => ({
                id: ph.placeholderKey,
                text: `~${ph.placeholderKey}~`,
                label: ph.placeholderLabel,
                description: ph.placeholderLabel,
                icon: this.getPlaceholderIcon(ph.placeholderType),
              }));
              
              if (this.templateType && this.placeholderConfigs[this.templateType]) {
                this.placeholderConfigs[this.templateType].placeholders = fetchedPlaceholders;
                this.initializePlaceholderCounts();
              }
            } 
          } else {
              this.eventBus.emit("toast", {
                title: "Failed to load placeholders",
                message: result.message || "Unknown error",
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