<template>
  <div>
    <h3 class="sidebar-title">Placeholders</h3>
    <ul class="list-group">
      <li
        v-for="placeholder in placeholders"
        :key="placeholder.id"
        class="list-group-item"
      >
        <div class="d-flex align-items-center">
          <div class="ms-2 me-auto">
            <div class="fw-bold">{{ placeholder.label }}</div>
            <p class="mb-1">{{ placeholder.text }}</p>
          </div>
          <div class="btn-container">
            <span class="badge bg-primary rounded-pill">{{ placeholderCounts[placeholder.id] }}</span>
            <button
              class="btn btn-primary btn-sm mt-2"
              @click="handlePlaceholderClick(placeholder)"
            >
              Add
            </button>
          </div>
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
        { id: "text", label: "Text placeholder", text: "~text~" },
        { id: "chart", label: "Single chart", text: "~chart~" },
        { id: "comparison", label: "Comparison chart", text: "~comparison~" },
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
      if (placeholder.text.includes("~text")) {
        placeholderType = "text";
      } else if (placeholder.text.includes("~chart~")) {
        placeholderType = "chart";
      } else if (placeholder.text.includes("~comparison~")) {
        placeholderType = "comparison";
      }
      if (placeholderType) {
        this.placeholderCounts[placeholderType] += 1;

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
.sidebar-title {
  font-size: 1.4rem;
  font-weight: bold;
  margin-top: 2px;
  margin-bottom: 10px;
}

.btn-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
