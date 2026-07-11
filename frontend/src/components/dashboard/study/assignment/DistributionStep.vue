<template>
  <div>
    <BasicForm ref="selectionModeForm" v-model="reviewerSelectionMode" :fields="reviewerSelectionModeFields" />
    <div v-if="reviewerSelectionMode.mode === 'role'">
      <p class="mt-2">Define the number of reviews that each user of the role should perform:</p>
      <BasicForm v-if="roleSelectionFields.length > 0" ref="roleBasedSelectionForm" v-model="roleSelection" class="mt-4" :fields="roleSelectionFields" />
      <div v-else>
        <p class="text-center text-danger mt-4">There are no roles available!</p>
        <p class="text-center">Please select reviewers with roles or change selection mode!</p>
      </div>
    </div>
    <div v-else-if="reviewerSelectionMode.mode === 'reviewer'">
      <p class="mt-2">Distribute the documents between the selected reviewers:</p>
      <p class="mb-4">Remaining Assignments: <strong>{{ remainingAssignments }}</strong></p>
      <BasicForm ref="reviewerBasedSelectionForm" v-model="reviewerSelection" :fields="reviewerSelectionFields" />
    </div>
    <p v-else>Please select a reviewer selection mode</p>
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
 * @author karim ouf
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
          label: "Number of reviews for role: " + role.name,
          type: "slider",
          class: 'custom-slider-class',
          min: 0,
          max: 10,
          step: 1,
          unit: 'review(s)',
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
        label: "Number of reviews for user: " + user.firstName + " " + user.lastName,
        type: "slider",
        class: 'custom-slider-class',
        min: 0,
        max: Number(this.remainingAssignments + Number(this.reviewerSelection[user.id])),
        step: 1,
        unit: 'review(s)',
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
