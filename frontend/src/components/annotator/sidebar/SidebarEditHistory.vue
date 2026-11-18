<template>
  <div class="edits-section">
    <div v-for="(dateGroups, dateCategory) in edits" :key="dateCategory">
      <h4 class="group-header">{{ dateCategory }}</h4>

      <div v-for="(group, exactDate) in dateGroups" :key="exactDate">
        <h5 class="date-header">{{ exactDate }}</h5>

        <ul class="list-group">
          <li v-for="edit in group" :key="edit.id" class="list-group-item">
            <SideCard>
              <template #header>
                {{ edit.timeLabel }} - {{ $t('annotator.createdByUser', { userId: edit.userId }) }}
              </template>
              <template #body>
                <p>{{ edit.text }}</p>
              </template>
              <template #footer>
                <BasicButton
                  class="btn btn-primary btn-sm"
                  :text="$t('common.show')"
                  @click="$emit('show-edit', edit.text)"
                />
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
import BasicButton from "@/basic/Button.vue";

/**
 * Edit history of the annotation sidebar
 *
 * Lists document edits grouped by date category and exact date; "Show" hands the edit's text back.
 *
 * @author Nils Dycke, Dennis Zyska, Marina Sakharova
 */
export default {
  name: "SidebarEditHistory",
  components: {SideCard, BasicButton},
  props: {
    // {dateCategory: {exactDate: [edit]}}
    edits: {type: [Array, Object], required: true},
  },
  emits: ['show-edit'],
};
</script>

<style scoped>
.edits-section {
  padding: 10px;
  border-bottom: 1px solid var(--bs-border-color, #ddd);
  margin-bottom: 10px;
}

.list-group-item {
  border: none;
  background-color: transparent;
  margin-top: 8px;
}
</style>
