<template>
  <div v-if="showEdits" class="edits-section">
    <div v-for="(dateGroups, dateCategory) in edits" :key="dateCategory">
      <h4 class="group-header">{{ dateCategory }}</h4>

      <div v-for="(group, exactDate) in dateGroups" :key="exactDate">
        <h5 class="date-header">{{ exactDate }}</h5>

        <ul class="list-group">
          <li v-for="edit in group" :key="edit.id" class="list-group-item">
            <SideCard>
              <template #header>
                {{ edit.timeLabel }} - Created by User {{ edit.userId }}
              </template>
              <template #body>
                <p>{{ edit.text }}</p>
              </template>
              <template #footer>
                <button class="btn btn-primary btn-sm" @click="handleEditClick(edit)">
                  Show
                </button>
              </template>
            </SideCard>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import SideCard from "./card/Card.vue";

export default {
  name: "EditsSection",
  components: { SideCard },
  props: {
    edits: {
      type: Object,
      required: true
    },
    showEdits: {
      type: Boolean,
      required: true
    }
  },
  emits: ['edit-click'],
  methods: {
    handleEditClick(edit) {
      this.$emit('edit-click', edit);
    }
  }
};
</script>

<style scoped>
.edits-section {
  padding: 10px;
  border-bottom: 1px solid #ddd;
  margin-bottom: 10px;
}

.group-header {
  font-weight: bold;
  font-size: 1rem;
  margin-bottom: 8px;
}

.date-header {
  font-weight: 500;
  font-size: 0.9rem;
  margin-bottom: 6px;
  color: #666;
}

.list-group-item {
  border: none;
  background-color: transparent;
  margin-top: 8px;
}
</style> 