<template>
  <BasicModal
    ref="bulkCloseModal"
    name="bulk-close-modal"
  >
    <template #title>
      <span>Bulk Close Studies</span>
    </template>
    <template #body>
      <div>
        <p class="mb-3">
          Choose which open studies to close. Only studies in the current project are affected.
        </p>
        <div class="mb-3">
          <label class="form-label" for="bulk-close-workflow">Workflow</label>
          <select
            id="bulk-close-workflow"
            v-model="workflowScope"
            class="form-select"
          >
            <option value="">
              All workflows
            </option>
            <option
              v-for="opt in workflowOptions"
              :key="opt.value"
              :value="String(opt.value)"
            >
              {{ opt.name }}
            </option>
          </select>
        </div>
        <div class="mb-2">
          <label class="form-label" for="bulk-close-user">Study user (owner)</label>
          <select
            id="bulk-close-user"
            v-model="studyUserScope"
            class="form-select"
          >
            <option value="any">
              Any user
            </option>
            <option value="role_guest">
              All users with role: Guest
            </option>
            <option
              v-for="opt in studyUserOptions"
              :key="opt.value"
              :value="'user:' + opt.value"
            >
              {{ opt.name }}
            </option>
          </select>
        </div>
        <p class="text-muted small mb-0">
          {{ scopeSummary }}
        </p>
        <div class="form-check mt-3">
          <input
            id="notifySessionsCheckbox"
            v-model="notifySessions"
            class="form-check-input"
            type="checkbox"
          >
          <label
            class="form-check-label"
            for="notifySessionsCheckbox"
          >
            Send email notification to participants with open sessions
          </label>
        </div>
      </div>
    </template>

    <template #footer>
      <div>
        <BasicButton
          :title="confirmButtonTitle"
          :disabled="matchingOpenCount === 0"
          class="btn btn-primary"
          @click="closeMatchingStudies"
        />
      </div>
    </template>

  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";

/**
 * Modal for bulk closing studies (optional filters: workflow, study user / guest role)
 * @author: Dennis Zyska
 */
export default {
  name: "BulkCloseModal",
  subscribeTable: ["user_role", "user_role_matching"],
  components: {
    BasicModal,
    BasicButton,
  },
  data() {
    return {
      notifySessions: false,
      workflowScope: "",
      studyUserScope: "any",
    };
  },
  computed: {
    projectId() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    },
    openStudiesInProject() {
      return this.$store.getters["table/study/getFiltered"](
          (study) =>
            study.projectId === this.projectId &&
            !study.template &&
            !study.deleted &&
            !study.closed
      );
    },
    workflowOptions() {
      const seen = new Set();
      const opts = [];
      for (const study of this.openStudiesInProject) {
        const id = study.workflowId;
        if (id == null || seen.has(id)) {
          continue;
        }
        seen.add(id);
        const wf = this.$store.getters["table/workflow/get"](id);
        const name = wf?.name ? `${wf.name} (id ${id})` : `Workflow ${id}`;
        opts.push({value: id, name});
      }
      return opts.sort((a, b) => a.name.localeCompare(b.name));
    },
    studyUserOptions() {
      const seen = new Set();
      const opts = [];
      for (const study of this.openStudiesInProject) {
        const id = study.userId;
        if (id == null || seen.has(id)) {
          continue;
        }
        seen.add(id);
        const user = this.$store.getters["table/user/get"](id);
        let name = `User ${id}`;
        if (user) {
          const parts = [user.firstName, user.lastName].filter(Boolean);
          if (parts.length) {
            name = parts.join(" ");
          } else if (user.userName) {
            name = user.userName;
          } else if (user.email) {
            name = user.email;
          }
        }
        opts.push({value: id, name});
      }
      return opts.sort((a, b) => a.name.localeCompare(b.name));
    },
    matchingOpenCount() {
      return this.matchingOpenStudies().length;
    },
    scopeSummary() {
      const n = this.matchingOpenCount;
      if (n === 0) {
        return "No open studies match the current filters.";
      }
      return `${n} open ${n === 1 ? "study matches" : "studies match"} these filters.`;
    },
    confirmButtonTitle() {
      return this.matchingOpenCount === 0
        ? "No studies to close"
        : `Close ${this.matchingOpenCount} ${this.matchingOpenCount === 1 ? "study" : "studies"}`;
    },
  },
  methods: {
    open() {
      this.notifySessions = false;
      this.workflowScope = "";
      this.studyUserScope = "any";
      this.$refs.bulkCloseModal.open();
    },
    matchingOpenStudies() {
      return this.openStudiesInProject.filter(
          (s) => this.studyMatchesWorkflow(s) && this.studyMatchesUserScope(s)
      );
    },
    studyMatchesWorkflow(s) {
      const wf = Number(this.workflowScope);
      if (!Number.isFinite(wf) || wf <= 0) {
        return true;
      }
      return Number(s.workflowId) === wf;
    },
    studyUserHasRole(userId, roleName) {
      if (userId == null) {
        return false;
      }
      const uid = Number(userId);
      const roles = this.$store.getters["table/user_role/getAll"] || [];
      const role = roles.find((r) => r.name === roleName && !r.deleted);
      if (!role) {
        return false;
      }
      const matches = this.$store.getters["table/user_role_matching/getFiltered"](
          (m) => !m.deleted && Number(m.userId) === uid && m.userRoleId === role.id
      );
      return matches.length > 0;
    },
    studyMatchesUserScope(s) {
      if (this.studyUserScope === "any") {
        return true;
      }
      if (this.studyUserScope === "role_guest") {
        return this.studyUserHasRole(s.userId, "guest");
      }
      if (typeof this.studyUserScope === "string" && this.studyUserScope.startsWith("user:")) {
        const id = Number(this.studyUserScope.slice("user:".length));
        return Number.isFinite(id) && id > 0 && Number(s.userId) === id;
      }
      return true;
    },
    closeMatchingStudies() {
      const matches = this.matchingOpenStudies();
      if (matches.length === 0) {
        this.eventBus.emit("toast", {
          title: "Nothing to close",
          message: "No open studies match the selected workflow and user filters.",
          variant: "warning",
        });
        return;
      }
      const ids = matches
          .map((s) => Number(s.id))
          .filter((n) => Number.isFinite(n));
      const data = {
        projectId: this.projectId,
        ignoreClosedState: false,
        notifySessions: this.notifySessions,
        progressId: this.$refs.bulkCloseModal.getProgressId(),
        bulkCloseUseIdList: true,
        studyIds: ids,
        studyIdsJson: JSON.stringify(ids),
      };
      this.$refs.bulkCloseModal.startProgress();
      this.$socket.emit("studyCloseBulk", data, (res) => {
        this.$refs.bulkCloseModal.stopProgress();
        if (res.success) {
          const closed = res.data?.closedCount ?? 0;
          this.eventBus.emit("toast", {
            title: closed > 0 ? "Studies closed" : "Bulk close finished",
            message:
              closed > 0
                ? `${closed} ${closed === 1 ? "study" : "studies"} closed.`
                : "No studies were updated (they may already be closed).",
            variant: closed > 0 ? "success" : "info",
          });
          this.$refs.bulkCloseModal.close();
        } else {
          this.eventBus.emit("toast", {
            title: "Bulk close failed",
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
  },

};
</script>

<style scoped>
.form-check-label {
  cursor: pointer;
}
</style>
