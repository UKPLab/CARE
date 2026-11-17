<template>
      <BasicSidebar
          v-if="studyDescription || questionHelp"
          class="dialogue-sidebar"
          :is-shown="isShown"
          active-side-bar="instructions"
      >
        <template #instructions>
          <SidebarTemplate icon="info-circle" :title="$t('ai.dialogue.instructions')">
            <template #content>
              <div class="dialogue-instructions p-3">
                <section v-if="studyDescription" class="instruction-section">
                  <h6 class="instruction-heading">{{ $t('ai.dialogue.generalInstructions') }}</h6>
                  <BasicEditor
                      :model-value="studyDescription"
                      :read-only="true"
                      class="instruction-editor"
                  />
                </section>
                <section v-if="questionHelp" class="instruction-section">
                  <h6 class="instruction-heading">{{ $t('ai.dialogue.questionHelp') }}</h6>
                  <p class="instruction-text mb-0">{{ questionHelp }}</p>
                </section>
              </div>
            </template>
          </SidebarTemplate>
        </template>
      </BasicSidebar>
</template>
<script>
import BasicEditor from '@/basic/editor/Editor.vue';
import BasicSidebar from '@/basic/Sidebar.vue';
import SidebarTemplate from '@/basic/sidebar/SidebarTemplate.vue';
export default {
  name: 'DialogueInstructions', components: {BasicEditor, BasicSidebar, SidebarTemplate},
  props: {
    studyDescription: {type: String, default: ''}, questionHelp: {type: String, default: ''},
    isShown: {type: Boolean, default: true},
  },
};
</script>
<style scoped>
.dialogue-instructions {
  background-color: var(--bs-body-bg);
  position: absolute;
  inset: 0;
  overflow-y: auto;
}

.instruction-section {
  border-bottom: 1px solid var(--bs-border-color);
  padding-bottom: 1rem;
  margin-bottom: 1rem;
}

.instruction-section:last-child {
  border-bottom: 0;
  margin-bottom: 0;
  padding-bottom: 0;
}

.instruction-heading {
  color: var(--bs-secondary-color);
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.instruction-text {
  color: var(--bs-body-color);
  line-height: 1.5;
}

.instruction-editor {
  border: 1px solid var(--bs-border-color);
  border-radius: 0.375rem;
  overflow: hidden;
  background-color: var(--bs-body-bg);
}

.instruction-editor :deep(.ql-editor) {
  min-height: 0;
  padding: 0.75rem;
  line-height: 1.5;
}

.dialogue-sidebar :deep(.sidebar-content) {
  background-color: var(--bs-body-bg);
}
</style>
