<template>
  <HeaderActions :actions="headerActions">
    <BasicButton
        class="btn-primary btn-sm"
        :title="$t('common.add')"
        :text="$t('common.add')"
        icon="plus"
        @click="$emit('add')"
    />
  </HeaderActions>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import HeaderActions from "@/basic/dashboard/HeaderActions.vue";

/**
 * Header actions of the studies dashboard. Each button is shown according to
 * the viewer's rights and emits an event the page turns into a modal.
 *
 * @author: Dennis Zyska, Nils Dycke, Manu Sundar Raj Nandyal
 */
export default {
  name: "StudyToolbar",
  components: { BasicButton, HeaderActions },
  emits: ["saved-templates", "manage-studies", "publish-assessment", "add-bulk-assignment", "add-single-assignment", "add"],
  computed: {
    /**
     * Secondary header buttons. The ones that do not fit next to the title
     * collapse into the "..." menu (HeaderActions); "Add" always stays visible.
     */
    headerActions() {
      return [
        {key: "savedTemplates", text: this.$t('studies.savedTemplates'), icon: "folder", onClick: () => this.$emit('saved-templates')},
        this.canManageStudies && {key: "manageStudies", text: this.$t('studies.manageStudies'), icon: "gear-fill", onClick: () => this.$emit('manage-studies')},
        {key: "publishAssessment", text: this.$t('submission.publishAssessment.title'), icon: "clipboard-data", onClick: () => this.$emit('publish-assessment')},
        this.canAddBulkAssignments && {key: "addBulkAssignments", text: this.$t('studies.addBulkAssignments'), icon: "stack", onClick: () => this.$emit('add-bulk-assignment')},
        this.isAdmin && {key: "addSingleAssignment", text: this.$t('studies.addSingleAssignment'), icon: "plus-square", onClick: () => this.$emit('add-single-assignment')},
      ].filter(Boolean);
    },
    isAdmin() {
      return this.$store.getters['auth/isAdmin'];
    },
    canAddBulkAssignments() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.addBulkAssignments");
    },
    canManageStudies() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.canManageStudies");
    },
  },
};
</script>
