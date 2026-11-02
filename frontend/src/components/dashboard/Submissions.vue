<template>
  <Card
    class="dashboard-page"
    :title="$t('sidebar.nav.submissions')"
  >
    <template #body>
      <div class="sessions-page">
        <section
          v-for="section in sections"
          :key="section.key"
          class="sessions-section"
        >
          <header class="sessions-section-head">
            <h2 class="sessions-section-title">{{ section.title }}</h2>
          </header>

          <div
            v-if="section.items.length === 0"
            class="sessions-empty"
          >
            <span
              class="sessions-empty-icon"
              aria-hidden="true"
            >
              <LoadIcon
                :icon-name="section.emptyIcon"
                :size="22"
              />
            </span>
            <p>{{ section.empty }}</p>
          </div>

          <div
            v-else
            class="sessions-grid sessions-grid--list"
          >
            <article
              v-for="(assignment, index) in section.items"
              :key="section.key + '-' + assignment.id"
              class="session-study"
              :class="[
                'session-study--' + assignmentStateSlug(assignment),
                { 'is-open': isOpen(assignment.id) },
              ]"
              :style="{ '--i': index }"
            >
              <header class="session-study-head">
                <span
                  class="study-state"
                  :class="'study-state--' + assignmentStateSlug(assignment)"
                >
                  <LoadIcon
                    v-if="getAssignmentStatus(assignment) === 'closed'"
                    icon-name="lock-fill"
                    :size="10"
                  />
                  <span
                    v-else
                    class="study-state-dot"
                  />
                  {{ $t('assignments.dashboard.status.' + getAssignmentStatus(assignment)) }}
                </span>
                <span class="session-study-id">#{{ assignment.id }}</span>
              </header>

              <button
                type="button"
                class="session-study-title"
                :title="assignment.name"
                :aria-expanded="isOpen(assignment.id) ? 'true' : 'false'"
                :aria-controls="'submissions-of-' + assignment.id"
                @click="toggle(assignment.id)"
              >
                {{ assignment.name }}
              </button>

              <div class="session-study-meta">
                <span
                  v-if="!canUploadForOthers"
                  class="session-study-meta-item"
                >
                  <LoadIcon
                    icon-name="file-earmark-check"
                    :size="12"
                  />
                  {{ remainingSubmissionsLabel(assignment) }}
                </span>
                <span
                  v-if="section.key === 'active'"
                  class="session-study-meta-item"
                >
                  <LoadIcon
                    icon-name="clock"
                    :size="12"
                  />
                  {{ timeBadgeText(assignment) }}
                </span>
              </div>

              <footer class="session-study-foot">
                <BasicButton
                  class="btn btn-primary btn-sm"
                  :title="$t('dashboard.uploadModal.title')"
                  :text="$t('dashboard.uploadModal.title')"
                  icon="file-earmark-arrow-up"
                  :disabled="!canUploadSubmissionForAssignment(assignment)"
                  @click="openUploadModalForAssignment(assignment)"
                />
                <button
                  type="button"
                  class="session-study-toggle"
                  :aria-expanded="isOpen(assignment.id) ? 'true' : 'false'"
                  :aria-controls="'submissions-of-' + assignment.id"
                  @click="toggle(assignment.id)"
                >
                  {{ isOpen(assignment.id) ? $t('common.showLess') : $t('common.details') }}
                  <LoadIcon
                    class="session-study-chevron"
                    icon-name="chevron-down"
                    :size="13"
                  />
                </button>
              </footer>

              <div
                v-if="isOpen(assignment.id)"
                :id="'submissions-of-' + assignment.id"
                class="session-study-body"
              >
                <AssignmentSubmissionsTable
                  :assignment-id="assignment.id"
                />
              </div>
            </article>
          </div>
        </section>
      </div>
    </template>
  </Card>

  <AssignmentUploadModal ref="uploadModal" />
  <ConfirmModal ref="deleteConf" />
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicButton from "@/basic/Button.vue";
import LoadIcon from "@/basic/Icon.vue";
import AssignmentUploadModal from "@/components/dashboard/assignments/AssignmentUploadModal.vue";
import AssignmentSubmissionsTable from "@/components/dashboard/assignments/AssignmentSubmissionsTable.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import { getTimeDiffString, isListedAssignment } from "@/assets/utils";
import { isAssignmentPastDeadline } from "@/assets/assignmentDeadline.js";

export default {
  name: "DashboardSubmission",
  subscribeTable: ["assignment", "submission", "user", "document"],
  components: { Card, BasicButton, LoadIcon, AssignmentUploadModal, AssignmentSubmissionsTable, ConfirmModal },
  data() {
    return {
      openAssignmentIds: [],
    };
  },
  computed: {
    sections() {
      return [
        {
          key: "active",
          title: this.$t("assignments.dashboard.submissions.activeTitle"),
          empty: this.$t("assignments.dashboard.submissions.noActive"),
          emptyIcon: "inbox",
          items: this.activeAssignments,
        },
        {
          key: "closed",
          title: this.$t("assignments.dashboard.submissions.closedTitle"),
          empty: this.$t("assignments.dashboard.submissions.noClosed"),
          emptyIcon: "archive",
          items: this.closedAssignments,
        },
      ];
    },
    canUploadForOthers() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.assignments.uploadForOthers");
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    assignments() {
      return this.$store.getters["table/assignment/getFiltered"](
        (assignment) => isListedAssignment(assignment, this.userId)
      ) || [];
    },
    assignmentTimes() {
      return Object.fromEntries(
        this.assignments.map((assignment) => [
          assignment.id,
          assignment.end ? getTimeDiffString(Date.now(), new Date(assignment.end)) : null,
        ])
      );
    },
    activeAssignments() {
      return this.assignments.filter((assignment) => this.getAssignmentStatus(assignment) !== "closed");
    },
    closedAssignments() {
      return this.assignments.filter((assignment) => this.getAssignmentStatus(assignment) === "closed");
    },
  },
  methods: {
    isOpen(assignmentId) {
      return this.openAssignmentIds.includes(assignmentId);
    },
    toggle(assignmentId) {
      const index = this.openAssignmentIds.indexOf(assignmentId);
      if (index >= 0) {
        this.openAssignmentIds.splice(index, 1);
      } else {
        this.openAssignmentIds.push(assignmentId);
      }
    },
    assignmentStateSlug(assignment) {
      const status = this.getAssignmentStatus(assignment);
      if (status === "open") return "running";
      if (status === "closed") return "closed";
      return "ended";
    },
    getAssignmentStatus(assignment) {
      if (assignment.closed) {
        return "closed";
      }

      const now = new Date();
      const start = assignment.start ? new Date(assignment.start) : null;

      if (start && now < start) {
        return "notStarted";
      }

      if (isAssignmentPastDeadline(assignment)) {
        return "closed";
      }

      return "open";
    },
    maxRevisionsForAssignment(assignment) {
      return Number(assignment?.maxRevisions || 0);
    },
    currentUserMaxRevisionDepth(assignmentId) {
      const userSubmissions = this.$store.getters["table/submission/getFiltered"](
        (submission) => submission.assignmentId === assignmentId && submission.userId === this.userId && !submission.deleted
      ) || [];

      if (userSubmissions.length === 0) {
        return 0;
      }

      const submissionById = new Map(userSubmissions.map((submission) => [submission.id, submission]));
      const depthCache = new Map();

      const getDepth = (submission) => {
        if (!submission) {
          return 0;
        }
        if (depthCache.has(submission.id)) {
          return depthCache.get(submission.id);
        }

        const visited = new Set();
        let depth = 1;
        let current = submission;

        while (current?.previousSubmissionId && submissionById.has(current.previousSubmissionId)) {
          if (visited.has(current.previousSubmissionId)) {
            break;
          }
          visited.add(current.previousSubmissionId);
          depth += 1;
          current = submissionById.get(current.previousSubmissionId);
        }

        depthCache.set(submission.id, depth);
        return depth;
      };

      return Math.max(...userSubmissions.map((submission) => getDepth(submission)));
    },
    isRevisionLimitReachedForAssignment(assignment) {
      const maxRevisions = this.maxRevisionsForAssignment(assignment);
      if (maxRevisions === -1) {
        return false;
      }
      return this.currentUserMaxRevisionDepth(assignment.id) >= maxRevisions + 1;
    },
    remainingSubmissionsCount(assignment) {
      const maxRevisions = this.maxRevisionsForAssignment(assignment);
      if (maxRevisions === -1) {
        return null;
      }
      return Math.max(maxRevisions + 1 - this.currentUserMaxRevisionDepth(assignment.id), 0);
    },
    remainingSubmissionsLabel(assignment) {
      const remaining = this.remainingSubmissionsCount(assignment);
      if (remaining === null) {
        return this.$t("assignments.dashboard.submissions.unlimited");
      }
      return this.$t("assignments.dashboard.submissions.remainingLeft", { count: remaining });
    },
    isAssignmentOverdue(assignment) {
      return isAssignmentPastDeadline(assignment);
    },
    timeBadgeText(assignment) {
      if (!assignment.end) {
        return this.$t("assignments.dashboard.submissions.noDueDate");
      }
      if (this.isAssignmentOverdue(assignment)) {
        return this.$t("assignments.dashboard.submissions.overdueBy", {
          time: this.assignmentTimes[assignment.id],
        });
      }
      return this.assignmentTimes[assignment.id];
    },
    canUploadSubmissionForAssignment(assignment) {
      const statusAllowsUpload = this.getAssignmentStatus(assignment) === "open";
      return statusAllowsUpload && !this.isRevisionLimitReachedForAssignment(assignment);
    },
    openUploadModalForAssignment(assignment) {
      if (this.isRevisionLimitReachedForAssignment(assignment)) {
        this.eventBus.emit("toast", {
          title: this.$t("assignments.dashboard.toasts.revisionLimitReached.title"),
          message: this.$t("assignments.dashboard.toasts.revisionLimitReached.message", {
            count: this.maxRevisionsForAssignment(assignment) + 1,
          }),
          variant: "warning",
        });
        return;
      }

      if (!this.canUploadSubmissionForAssignment(assignment)) {
        this.eventBus.emit("toast", {
          title: this.$t("assignments.dashboard.toasts.uploadNotAllowed.title"),
          message: this.$t("assignments.dashboard.toasts.uploadNotAllowed.message"),
          variant: "warning",
        });
        return;
      }

      this.$refs.uploadModal.open(assignment.id);
    },
  },
};
</script>
