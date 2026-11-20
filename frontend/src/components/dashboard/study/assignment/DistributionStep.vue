<template>
  <div>
    <BasicForm ref="selectionModeForm" v-model="reviewerSelectionMode" :fields="reviewerSelectionModeFields" />
    <div v-if="reviewerSelectionMode.mode === 'role'">
      <p class="mt-2">{{ $t('dashboard.study.defineTheNumberOfReviews') }}</p>
      <BasicForm v-if="roleSelectionFields.length > 0" ref="roleBasedSelectionForm" v-model="roleSelection" class="mt-4" :fields="roleSelectionFields" />
      <div v-else>
        <p class="text-center text-danger mt-4">{{ $t('dashboard.study.noRolesAvailable') }}</p>
        <p class="text-center">{{ $t('dashboard.study.selectReviewersOrChangeMode') }}</p>
      </div>
    </div>
    <div v-else-if="reviewerSelectionMode.mode === 'reviewer'">
      <p class="mt-2">{{ $t('dashboard.study.discontributeDocuments') }}</p>
      <p class="mb-4">{{ $t('dashboard.study.remainingAssignments') }} <strong>{{ remainingAssignments }}</strong></p>
      <BasicForm ref="reviewerBasedSelectionForm" v-model="reviewerSelection" :fields="reviewerSelectionFields" />
    </div>
    <p v-else>{{ $t('dashboard.study.selectMode') }}</p>
  </div>
</template>

<script>
import BasicForm from "@/basic/Form.vue";

/**
 * Step component for configuring how assignments are distributed across reviewers.
 * Supports three modes: role-based (each role gets N reviews), reviewer-based
 * (documents split manually between selected reviewers), and session-user-based
 * (each study session is assigned to its original user).
 * State is persisted via modalValue so navigating back restores the user's choices; the
 * emitted modalValue also carries the resulting numberOfReviews for the summary.
 * @author: Dennis Zyska, Alexander Bürkle, Linyin Huang, Karim Ouf
 */
export default {
  name: "DistributionStep",
  components: { BasicForm },
  inject: {
    selectedReviewer: { type: Array, required: false, default: () => [] },
    selectedAssignments: { type: Array, required: false, default: () => [] },
    assignmentCount: { type: Number, required: false, default: 0 },
    assignmentType: { type: String, required: false, default: 'document' },
    roles: { type: Array, required: false, default: () => [] },
  },
  props: {
    modalValue: {
      type: Object,
      default: () => ({}),
    },
  },
  emits: ["update:modalValue", "update:isValid"],
  data() {
    return {
      reviewerSelectionMode: this.modalValue?.reviewerSelectionMode ? { ...this.modalValue.reviewerSelectionMode } : {},
      roleSelection: this.modalValue?.roleSelection ? { ...this.modalValue.roleSelection } : {},
      reviewerSelection: this.modalValue?.reviewerSelection ? { ...this.modalValue.reviewerSelection } : {},
    };
  },
  computed: {
    reviewerSelectionModeFields() {
      const options = [
        { name: this.$t("dashboard.study.roleBasedSelection"), value: "role" },
        { name: this.$t("dashboard.study.reviewerBasedSelection"), value: "reviewer" },
      ];
      if (this.assignmentType === 'study_session') {
        options.push({ name: this.$t("dashboard.study.sessionUserBasedSelection"), value: "session_user" });
      }
      return [{
        key: "mode",
        label: this.$t("dashboard.study.reviewerSelectionMode"),
        type: "select",
        options,
        required: true,
      }];
    },
    selectedReviewerRoles() {
      return [...new Set(this.selectedReviewer.flatMap(obj => obj.roles))];
    },
    roleSelectionFields() {
      return this.selectedReviewerRoles.map(roleId => {
        const role = this.roles.find(r => r.id === roleId);
        return {
          key: role.id,
          label: this.$t("dashboard.study.numberOfReviewsForRole", { name: role.name }),
          type: "slider",
          class: 'custom-slider-class',
          min: 0,
          max: 10,
          step: 1,
          unit: this.$t("dashboard.study.reviews"),
        };
      });
    },
    remainingAssignments() {
      const total = this.assignmentCount || this.selectedAssignments.length;
      return total - this.sumOf(this.reviewerSelection);
    },
    reviewerSelectionFields() {
      return this.selectedReviewer.map(user => ({
        key: user.id,
        label: this.$t("dashboard.study.numberOfReviewsForUser", {
          name: `${user.firstName} ${user.lastName}`,
        }),
        type: "slider",
        class: 'custom-slider-class',
        default: 0,
        min: 0,
        max: this.selectedAssignments.length,
        step: 1,
        unit: this.$t("dashboard.study.reviews"),
      }));
    },
    isValid() {
      if (this.reviewerSelectionMode.mode === 'reviewer') {
        return this.remainingAssignments === 0;
      } else if (this.reviewerSelectionMode.mode === 'role') {
        return this.sumOf(this.roleSelection) > 0;
      }
      return this.reviewerSelectionMode.mode === 'session_user';
    },
    numberOfReviews() {
      if (this.reviewerSelectionMode.mode === 'role') {
        return this.sumOf(this.roleSelection) * (this.assignmentCount || this.selectedAssignments.length);
      }
      return this.sumOf(this.reviewerSelection);
    },
    distribution() {
      return {
        reviewerSelectionMode: this.reviewerSelectionMode,
        roleSelection: this.roleSelection,
        reviewerSelection: this.reviewerSelection,
        numberOfReviews: this.numberOfReviews,
      };
    },
  },
  watch: {
    selectedReviewer: {
      handler() {
        this.reviewerSelection = {};
        this.roleSelection = {};
      },
      deep: true,
    },
    distribution: {
      handler(val) {
        this.$emit('update:modalValue', val);
      },
      deep: true,
    },
    isValid(val) {
      this.$emit('update:isValid', val);
    },
  },
  methods: {
    /** Total of the slider values in a role or reviewer selection. */
    sumOf(selection) {
      return Object.values(selection).map(value => parseInt(value, 0)).reduce((a, b) => a + b, 0);
    },
    reset() {
      this.reviewerSelectionMode = {};
      this.roleSelection = {};
      this.reviewerSelection = {};
    },
  },
};
</script>
