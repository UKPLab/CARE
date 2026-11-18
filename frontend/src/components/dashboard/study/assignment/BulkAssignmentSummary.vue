<template>
  <div>
    <p>{{ $t('dashboard.study.createAssignmentConfirmPrompt') }}</p>
    <p v-if="reviewerSelectionMode.mode !== 'session_user'" class="text-danger">
      <strong>{{ $t('dashboard.study.warning') }}</strong> {{ $t('dashboard.study.notReviewOwnDocument') }}
      <br>{{ $t('dashboard.study.warning1') }}
      <br>{{ $t('dashboard.study.warning2') }}
    </p>
    <p v-else class="text-warning">
      <strong>{{ $t('dashboard.study.warning') }}</strong> {{ $t('dashboard.study.sessionUserSelectionWarning') }}
      <br>
      <span v-if="unmatchedReviewersForSessions.length > 0" class="text-danger">
        {{ $t('dashboard.study.reviewersWithoutMatchingStudySessions') }}
        <ul>
          <li v-for="unmatchedReviewer in unmatchedReviewersForSessions" :key="unmatchedReviewer.id">
            {{ unmatchedReviewer.firstName }} {{ unmatchedReviewer.lastName }}
            ({{ $t('common.id') }}: {{ unmatchedReviewer.id }})
          </li>
        </ul>
      </span>
      <span v-else>{{ $t('dashboard.study.allReviewersHaveMatchingStudySessions') }}</span>
    </p>
    <div class="container">
      <div v-for="row in summaryRows" :key="row.label" class="row mb-2">
        <div class="col-2"><strong>{{ $t(row.label) }}</strong></div>
        <div class="col-8">{{ row.value }}</div>
      </div>
      <div v-if="reviewerSelectionMode.mode === 'role'" class="row mb-2">
        <div class="col-2"><strong>{{ $t('dashboard.study.roles') }}</strong></div>
        <div class="col-8">
          <ul>
            <li v-for="(value, key) in listOfSelectedRoles" :key="key">- {{ value.role }}: {{ value.value }}</li>
          </ul>
        </div>
      </div>
      <div v-if="reviewerSelectionMode.mode === 'reviewer'" class="row mb-2">
        <div class="col-2"><strong>{{ $t('dashboard.study.reviewers') }}</strong></div>
        <div class="col-8">
          <ul>
            <li v-for="(value, key) in listOfSelectedReviewers" :key="key">- {{ value.reviewer }}: {{ value.value }}</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * Read-only summary of a bulk assignment (documents, submissions or study sessions):
 * counts, distribution mode and per-role / per-reviewer quotas. Warns when reviewers
 * lack matching study sessions in session_user mode.
 * @author: Dennis Zyska, Alexander Bürkle, Linyin Huang, Karim Ouf
 */
export default {
  name: "BulkAssignmentSummary",
  inject: {
    template: { type: Object, required: false, default: null },
    workflow: { type: Object, required: false, default: null },
    assignmentType: { type: String, required: false, default: 'document' },
    selectedAssignments: { type: Array, required: false, default: () => [] },
    selectedReviewer: { type: Array, required: false, default: () => [] },
    assignmentCount: { type: Number, required: false, default: 0 },
    reviewerCount: { type: Number, required: false, default: 0 },
    reviewerSelectionMode: { type: Object, required: false, default: () => ({}) },
    numberOfReviews: { type: Number, required: false, default: 0 },
    roles: { type: Array, required: false, default: () => [] },
    roleSelection: { type: Object, required: false, default: () => ({}) },
    reviewerSelection: { type: Object, required: false, default: () => ({}) },
  },
  computed: {
    summaryRows() {
      const modeLabel = {
        role: "roleBasedSelection",
        reviewer: "reviewerBasedSelection",
        session_user: "sessionUserBasedSelection",
      }[this.reviewerSelectionMode.mode];
      return [
        { label: 'dashboard.study.template', value: this.template?.name },
        { label: 'dashboard.study.workflow', value: this.workflow?.name },
        { label: 'dashboard.study.documents', value: this.assignmentCount || this.selectedAssignments.length },
        { label: 'dashboard.study.reviewers', value: this.reviewerCount || this.selectedReviewer.length },
        { label: 'dashboard.study.reviewsToCreate', value: this.numberOfReviews },
        {
          label: 'dashboard.study.selectionMode',
          value: modeLabel ? this.$t(`dashboard.study.${modeLabel}`) : undefined,
        },
      ];
    },
    listOfSelectedRoles() {
      return Object.keys(this.roleSelection).map(key => {
        const role = this.roles.find(r => r.id === parseInt(key));
        return { role: role ? role.name : key, value: this.roleSelection[key] };
      });
    },
    listOfSelectedReviewers() {
      return Object.keys(this.reviewerSelection).map(key => {
        const user = this.selectedReviewer.find(r => r.id === parseInt(key));
        return {
          reviewer: user ? `${user.firstName} ${user.lastName}` : key,
          value: this.reviewerSelection[key],
        };
      });
    },
    unmatchedReviewersForSessions() {
      if (this.assignmentType !== 'study_session' || this.reviewerSelectionMode.mode !== 'session_user') {
        return [];
      }
      const selectedSessionUserIds = new Set(
          this.selectedAssignments.map(session =>
            session.sessionUserId ?? session.userId
          ).filter(userId => userId !== null && userId !== undefined)
      );
      return this.selectedReviewer.filter(rev => !selectedSessionUserIds.has(rev.id));
    },
  },
};
</script>
