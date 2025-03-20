<template>
  <div>
    <h3 class="sidebar-title">Placeholders</h3>
    <ul class="list-group">
      <li
        v-for="placeholder in placeholders"
        :key="placeholder.id"
        class="list-group-item"
      >
        <div class="d-flex justify-content-between align-items-center">
          <div class="ms-2 me-auto">
            <div class="fw-bold">{{ placeholder.label }}</div>
            <p class="mb-1">{{ placeholder.text }}</p>
          </div>
          <button
            class="btn btn-primary btn-sm"
            @click="handlePlaceholderClick(placeholder)"
          >
            Add
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>


<script>

export default {
  name: "SidebarConfigurator",
  inject: {
    studySessionId: {
      type: Number,
      required: false,
      default: null // Allows for null if not in a study session
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
        { id: "placeholder1", label: "Text placeholder", text: "~text[d+]~" },
        { id: "placeholder2", label: "Single chart", text: "~chart[d+]~" },
        { id: "placeholder3", label: "Comparison chart", text: "~comparison[d+]~" },
      ],
      placeholderCounts: {
        text: 0,
        chart: 0,
        comparison: 0,
      },
    };
  },
  methods: {
    handlePlaceholderClick(placeholder) {
      let placeholderType = null;
      if (placeholder.text.includes("~text[d+]~")) {
        placeholderType = "text";
      } else if (placeholder.text.includes("~chart[d+]~")) {
        placeholderType = "chart";
      } else if (placeholder.text.includes("~comparison[d+]~")) {
        placeholderType = "comparison";
      }
      if (placeholderType) {
        this.placeholderCounts[placeholderType] += 1;
        const newPlaceholderText = placeholder.text.replace(
          "[d+]",
          `[${this.placeholderCounts[placeholderType]}]`
        );

        this.eventBus.emit("editorInsertText", {
          documentId: this.documentId,
          text: newPlaceholderText,
        });
      } 
    },
  },
};
</script>

<style scoped>

.sidebar-title {
  font-size: 1.4rem;
  font-weight: bold;
  margin-top: 2px;
  margin-bottom: 10px;
}
</style>