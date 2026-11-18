<template>
  <div class="btn-group gap-2">
    <BasicButton
        class="btn-secondary btn-sm"
        :title="$t('studies.savedTemplates')"
        :text="$t('studies.savedTemplates')"
        icon="folder"
        @click="$emit('saved-templates')"
    />
    <BasicButton
        v-if="canManageStudies"
        class="btn-secondary btn-sm"
        :title="$t('studies.manageStudies')"
        :text="$t('studies.manageStudies')"
        icon="gear-fill"
        @click="$emit('manage-studies')"
    />
    <BasicButton
      class="btn-secondary btn-sm"
      :title="$t('submission.publishAssessment.title')"
      :text="$t('submission.publishAssessment.title')"
      icon="clipboard-data"
      @click="$emit('publish-assessment')"
    />
    <BasicButton
        v-if="canAddBulkAssignments"
        class="btn-secondary btn-sm"
        :title="$t('studies.addBulkAssignments')"
        :text="$t('studies.addBulkAssignments')"
        icon="stack"
        @click="$emit('add-bulk-assignment')"
    />
    <BasicButton
        v-if="isAdmin"
        class="btn-secondary btn-sm"
        :title="$t('studies.addSingleAssignment')"
        :text="$t('studies.addSingleAssignment')"
        icon="plus-square"
        @click="$emit('add-single-assignment')"
    />
    <BasicButton
        class="btn-primary btn-sm"
        :title="$t('common.add')"
        :text="$t('common.add')"
        icon="plus"
        @click="$emit('add')"
    />
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";

/**
 * Header actions of the studies dashboard. Each button is shown according to
 * the viewer's rights and emits an event the page turns into a modal.
 *
 * @author: Dennis Zyska, Nils Dycke, Manu Sundar Raj Nandyal
 */
export default {
  name: "StudyToolbar",
  components: { BasicButton },
  emits: ["saved-templates", "manage-studies", "publish-assessment", "add-bulk-assignment", "add-single-assignment", "add"],
  computed: {
    isAdmin() {
      return this.$store.getters['auth/isAdmin'];
    },
    canAddBulkAssignments() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.addBulkAssignments");
    },
    canAddSingleAssignments() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.addSingleAssignments");
    },
    canManageStudies() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.canManageStudies");
    },
  },
};
</script>
