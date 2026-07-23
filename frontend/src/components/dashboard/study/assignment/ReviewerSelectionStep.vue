<template>
  <div>
    <div v-if="bulk" class="form-check">
      <input id="filterHasDocumentsCheckbox" v-model="filterHasDocuments" class="form-check-input" type="checkbox">
      <label class="form-check-label" for="filterHasDocumentsCheckbox">
        {{ $t('dashboard.study.filterUsersWithDocuments') }}
      </label>
      <br>
      <input id="filterSelectedDocumentsCheckbox" v-model="filterSelectedDocuments" class="form-check-input" type="checkbox">
      <label class="form-check-label" for="filterSelectedDocumentsCheckbox">
        {{ $t('dashboard.study.filterUsersFromPreviousDocuments') }}
      </label>
    </div>
    <BasicTable
        v-model="selectedReviewer"
        :columns="reviewerTableColumns"
        :data="reviewerTable"
        :options="reviewerTableOptions"
        :max-table-height="400"
    />
  </div>
</template>

<script>
import BasicTable from "@/basic/Table.vue";

/**
 * Step component for selecting which users will act as reviewers in the assignment.
 * Displays a filterable, selectable table of all users with optional filters to
 * show only users who have documents or users from previously selected assignments.
 * State is persisted via modalValue so navigating back restores the selection.
 * @author: Dennis Zyska, Alexander Bürkle, Linyin Huang, Karim Ouf
 */
export default {
  name: "ReviewerSelectionStep",
  components: { BasicTable },
  props: {
    selectedAssignmentUserIds: {
      type: Array,
      default: () => [],
    },
    bulk: {
      type: Boolean,
      default: true,
    },
    modalValue: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      filterHasDocuments: false,
      filterSelectedDocuments: false,
      selectedReviewer: [...(this.modalValue || [])],
      reviewerTableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        scrollY: true,
        scrollX: true,
        onlyOneRowSelectable: false,
        search: true,
        pagination: 10,
      },
    };
  },
  computed: {
    roles() {
      return this.$store.getters["admin/getSystemRoles"] || [];
    },
    documents() {
      return this.$store.getters["table/document/getFiltered"](d => d.readyForReview);
    },
    allUsers() {
      return this.$store.getters["table/user/getAll"];
    },
    reviewerRoles() {
      return [...new Set(this.reviewerTable.flatMap(obj => {
        return obj.rolesNames.split(/,\s*/).filter(n => n !== "");
      }))];
    },
    selectedReviewerRoles() {
      return [...new Set(this.selectedReviewer.flatMap(obj => obj.roles))];
    },
    reviewerTable() {
      return this.allUsers.map(r => {
        let newR = { ...r };
        newR.studySessions = this.userStudySessions(r.id).filter(s => this.isStudyClosed(s.studyId)).length;
        newR.documents = this.documents.filter(d => d.userId === r.id).length;
        newR.rolesNames = (r.roles || [])
            .map(role => {
              const foundRole = (this.roles || []).find(roleObj => roleObj.id === role);
              return foundRole ? foundRole.name : null;
            })
            .filter(name => name !== null)
            .join(", ");
        return newR;
      }).filter(reviewer => {
        if (!this.filterHasDocuments && !this.filterSelectedDocuments) return true;
        if (this.filterHasDocuments && reviewer.documents < 1) return false;
        return !(this.filterSelectedDocuments && !this.selectedAssignmentUserIds.includes(reviewer.id));
      });
    },
    reviewerTableColumns() {
      return [
        { name: this.$t("common.id"), key: "id" },
        { name: this.$t("dashboard.projects.extId"), key: "extId" },
        { name: this.$t("common.firstName"), key: "firstName" },
        { name: this.$t("common.lastName"), key: "lastName" },
        { name: this.$t("dashboard.projects.numberOfAssignments"), key: "studySessions" },
        {
          name: this.$t("dashboard.study.documents"),
          key: "documents",
          filter: { type: "numeric", defaultOperator: "gte", defaultValue: 0 },
        },
        {
          name: this.$t("dashboard.study.roles"),
          key: "rolesNames",
          filter: this.reviewerRoles.map(r => ({ key: r, name: r })),
        },
      ];
    },
    isValid() {
      return this.selectedReviewer.length > 0;
    },
  },
  watch: {
    selectedReviewer: {
      handler(val) {
        this.$emit('update:selectedReviewer', val);
        this.$emit('update:selectedReviewerRoles', this.selectedReviewerRoles);
      },
      deep: true,
    },
    selectedReviewerRoles(val) {
      this.$emit('update:selectedReviewerRoles', val);
    },
    isValid(val) {
      this.$emit('update:isValid', val);
    },
  },
  mounted() {
    this.$emit('update:isValid', this.isValid);
    if (this.selectedReviewer.length > 0) {
      this.$emit('update:selectedReviewer', this.selectedReviewer);
      this.$emit('update:selectedReviewerRoles', this.selectedReviewerRoles);
    }
  },
  methods: {
    userStudySessions(userId) {
      return this.$store.getters["table/study_session/getFiltered"](s => s.userId === userId);
    },
    isStudyClosed(studyId) {
      const study = this.$store.getters["table/study/get"](studyId);
      if (!study) return false;
      return study.closed === null;
    },
    reset() {
      this.filterHasDocuments = false;
      this.filterSelectedDocuments = false;
      this.selectedReviewer = [];
    },
  },
};
</script>
