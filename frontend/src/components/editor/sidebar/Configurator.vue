<template>
  <!-- Placeholders Section -->
  <div v-if="placeholders && placeholders.length > 0" class="placeholders-section">
    <h6 class="section-header">Placeholders</h6>
    <ul id="placeholder-list" class="list-group">
      <li
        v-for="placeholder in placeholders"
        :key="placeholder.id"
        class="list-group-item"
      >
        <SideCard>
          <template #header>
            {{ placeholder.label }}
          </template>
          <template #body>
            <p>{{ placeholder.text }}</p>
          </template>
          <template #footer>
            <button
              class="btn btn-primary btn-sm"
              @click="handlePlaceholderClick(placeholder)"
            >
              Add
            </button>
          </template>
        </SideCard>
      </li>
    </ul>
  </div>

</template>

<script>
import SideCard from "@/components/annotator/sidebar/card/Card.vue";

export default {
  name: "SidebarConfigurator",
  components: {SideCard},
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
        {id: "placeholder1", label: "Placeholder to insert a link", text: "~link[d+]~"},
        {id: "placeholder2", label: "Placeholder to insert an NLP model", text: "~nlp[d+]~"},
      ],
    };
  },
  methods: {
    handlePlaceholderClick(placeholder) {
      this.eventBus.emit("editorInsertText", {
        documentId: this.documentId,
        text: placeholder.text
      });
    },
  },
};
</script>

<style scoped>

.list-group-item {
  border: none;
  background-color: transparent;
  margin-top: 8px;
}

.placeholders-section {
  padding: 10px;
  border-bottom: 1px solid #ddd;
  margin-bottom: 10px;
}

.section-header {
  font-weight: bold;
  font-size: 1rem;
  margin-bottom: 8px;
}

#placeholder-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
</style>