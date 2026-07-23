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
 * State is persisted via modalValue so navigating back restores the user's choices.
 * @author: Dennis Zyska, Alexander Bürkle, Linyin Huang, Karim Ouf
 */
export default {
  name: "DistributionStep",
  components: { BasicForm },
  props: {
    modalValue: {
      type: Object,
      default: () => ({}),
    },
  },
  inject: {
    selectedReviewer: { type: Array, required: false, default: () => [] },
    selectedAssignments: { type: Array, required: false, default: () => [] },
    assignmentType: { type: String, required: false, default: 'document' },
    roles: { type: Array, required: false, default: () => [] },
    reviewerSelectionModeFields: { type: Array, required: false, default: () => [] },
  },
  data() {
    return {
      reviewerSelectionMode: this.modalValue?.reviewerSelectionMode ? { ...this.modalValue.reviewerSelectionMode } : {},
      roleSelection: this.modalValue?.roleSelection ? { ...this.modalValue.roleSelection } : {},
      reviewerSelection: this.modalValue?.reviewerSelection ? { ...this.modalValue.reviewerSelection } : {},
    };
  },
  computed: {
    selectedReviewerRoles() {
      return [...new Set(this.selectedReviewer.flatMap(obj => obj.roles))];
    },
    roleSelectionFields() {
      return this.selectedReviewerRoles.map(roleId => {
        const role = this.roles.find(r => r.id === roleId);
        return {
          key: role.id,
          label: this.$t("dashboard.study.nameOfReviewsForRole") + role.name,
          type: "slider",
          class: 'custom-slider-class',
          min: 0,
          max: 10,
          step: 1,
          unit: this.$t("dashboard.study.reviews"),
        };
      });
    },
    reviewerNumberOfAssignments() {
      return Object.values(this.reviewerSelection)
          .map(value => parseInt(value, 0))
          .reduce((a, b) => a + b, 0);
    },
    remainingAssignments() {
      return this.selectedAssignments.length - this.reviewerNumberOfAssignments;
    },
    reviewerSelectionFields() {
      return this.selectedReviewer.map(user => ({
        key: user.id,
        label: this.$t("dashboard.study.nameofReviewsForUsers") + user.firstName + " " + user.lastName,
        type: "slider",
        class: 'custom-slider-class',
        min: 0,
        max: Number(this.remainingAssignments + Number(this.reviewerSelection[user.id])),
        step: 1,
        unit: this.$t("dashboard.study.reviews"),
      }));
    },
    selectionValid() {
      if (this.reviewerSelectionMode.mode === 'reviewer') {
        return this.remainingAssignments === 0;
      } else if (this.reviewerSelectionMode.mode === 'role') {
        return Object.values(this.roleSelection)
            .map(value => parseInt(value, 0))
            .reduce((a, b) => a + b, 0) > 0;
      } else if (this.reviewerSelectionMode.mode === 'session_user') {
        return true;
      }
      return false;
    },
    isValid() {
      return this.selectionValid;
    },
    numberOfReviews() {
      if (this.reviewerSelectionMode.mode === 'role') {
        return Object.values(this.roleSelection)
            .map(value => parseInt(value, 0))
            .reduce((a, b) => a + b, 0) * this.selectedAssignments.length;
      } else {
        return Object.values(this.reviewerSelection)
            .map(value => parseInt(value, 0))
            .reduce((a, b) => a + b, 0);
      }
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
    reviewerSelectionMode: {
      handler(val) {
        this.$emit('update:reviewerSelectionMode', val);
      },
      deep: true,
    },
    roleSelection: {
      handler(val) {
        this.$emit('update:roleSelection', val);
        this.$emit('update:selectionValid', this.selectionValid);
        this.$emit('update:numberOfReviews', this.numberOfReviews);
      },
      deep: true,
    },
    reviewerSelection: {
      handler(val) {
        this.$emit('update:reviewerSelection', val);
        this.$emit('update:selectionValid', this.selectionValid);
        this.$emit('update:numberOfReviews', this.numberOfReviews);
      },
      deep: true,
    },
    selectionValid: {
      handler(val) {
        this.$emit('update:selectionValid', val);
      },
      deep: true,
    },
    numberOfReviews: {
      handler(val) {
        this.$emit('update:numberOfReviews', val);
      },
      deep: true,
    },
    isValid(val) {
      this.$emit('update:isValid', val);
    },
  },
  methods: {
    reset() {
      this.reviewerSelectionMode = {};
      this.roleSelection = {};
      this.reviewerSelection = {};
    },
  },
};
</script>
