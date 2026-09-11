<template>
  <div class="card shadow mb-4 configurator">
    <div class="card-header bg-body">
      <h3 class="card-title fw-bold mb-0">{{ $t("sidebar.placeholders") }}</h3>
    </div>
    <div class="card-body p-0">
      <ul class="list-group list-group-flush">
        <li
          v-for="placeholder in placeholders"
          :key="placeholder.id"
          class="list-group-item"
        >
          <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center">
              <div class="icon-container rounded p-2 text-primary">
                <i :class="placeholder.icon"></i>
              </div>
              <div class="d-flex flex-column">
                <div class="d-flex align-items-center">
                  <h5 class="mb-0 me-1">{{ $t(placeholder.label) }}</h5>
                  <FormHelp
                    :help="getPlaceholderHelp(placeholder.id)"
                  />
                </div>
                <p class="text-muted small mb-0 mt-1">{{ $t(placeholder.description) }}</p>
              </div>
            </div>
            <div class="d-flex align-items-center">
              <span class="badge rounded-pill me-2 text-primary">{{ placeholderCounts[placeholder.id] }}</span>
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
</template>

<script>
import FormHelp from "@/basic/form/Help.vue";
import BasicButton from "@/basic/Button.vue";

export default {
  name: "SidebarConfigurator",
  components: {
    FormHelp,
    BasicButton,
  },
  inject: {
    studySessionId: {
      type: Number,
      required: false,
      default: null, // Allows for null if not in a study session
    },
    documentId: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  data() {
    return {
      isSidebarVisible: true,
      placeholders: [
        { id: "text", label: "sidebar.textPlaceholder", text: "~text~", description: "sidebar.textPlaceholderDescription", icon: "bi bi-type" },
        { id: "chart", label: "sidebar.singleChart", text: "~chart~", description: "sidebar.singleChartDescription", icon: "bi bi-bar-chart" },
        { id: "comparison", label: "sidebar.comparisonChart", text: "~comparison~", description: "sidebar.comparisonChartDescription", icon: "bi bi-bar-chart-steps" },
      ],
      placeholderCounts: {
        text: 0,
        chart: 0,
        comparison: 0,
      },
    };
  },
  mounted() {
    this.editorContentHandler = (data) => {
      if (data.documentId === this.documentId) {
        this.updatePlaceholderCounts(data.content);
      }
    };
    this.eventBus.on("editorContentUpdated", this.editorContentHandler);
  },
  unmounted() {
    this.eventBus.off("editorContentUpdated", this.editorContentHandler);
  },
  methods: {
    getPlaceholderHelp(placeholderId) {
      const longDescriptions = {
        text: this.$t("sidebar.textPlaceholderHelp"),
        chart: this.$t("sidebar.singleChartHelp"),
        comparison: this.$t("sidebar.comparisonChartHelp"),
      };
      return longDescriptions[placeholderId] || "";
    },
    updatePlaceholderCounts(editorContent) {
      // Reset counts
      Object.keys(this.placeholderCounts).forEach((key) => {
        this.placeholderCounts[key] = 0;
      });

      // Count placeholders in the content
      if (editorContent) {
        const textMatches = editorContent.match(/~text~/g);
        if (textMatches) {
          this.placeholderCounts.text = textMatches.length;
        }

        const chartMatches = editorContent.match(/~chart~/g);
        if (chartMatches) {
          this.placeholderCounts.chart = chartMatches.length;
        }

        const comparisonMatches = editorContent.match(/~comparison~/g);
        if (comparisonMatches) {
          this.placeholderCounts.comparison = comparisonMatches.length;
        }
      }
    },
    handlePlaceholderClick(placeholder) {
      let placeholderType = null;
      if (placeholder.text.includes("~text")) {
        placeholderType = "text";
      } else if (placeholder.text.includes("~chart~")) {
        placeholderType = "chart";
      } else if (placeholder.text.includes("~comparison~")) {
        placeholderType = "comparison";
      }
      if (placeholderType) {
        this.eventBus.emit("editorInsertText", {
          documentId: this.documentId,
          text: placeholder.text,
        });
      }
    },
  },
};
</script>

<style scoped>
.configurator {
  --bg-color: var(--bs-secondary-bg, rgb(219, 234, 254));
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
  color: var(--bs-body-color);
  background-color: var(--bg-color);
}

.list-group-item:hover {
  background-color: var(--bs-tertiary-bg, #f8f9fa);
}

.badge {
  background-color: var(--bg-color);
}
</style>
