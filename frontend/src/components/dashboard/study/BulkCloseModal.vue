<template>
  <BasicModal
    ref="bulkCloseModal"
    name="bulk-close-modal"
    size="xl"
  >
    <template #title>
      <span>Bulk Close Studies</span>
    </template>
    <template #body>
      <div>
        <p class="mb-3">
          Filter and select open studies to close. Only studies in the current project are affected.
        </p>
        <BasicTable
          v-model="selectedStudies"
          :columns="columns"
          :data="tableRows"
          :options="tableOptions"
          :max-table-height="'50vh'"
        />
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
          :disabled="selectedStudies.length === 0"
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
import BasicTable from "@/basic/Table.vue";

/**
 * Modal for bulk closing studies (optional filters: workflow, study user)
 * @author: Dennis Zyska
 */
export default {
  name: "BulkCloseModal",
  subscribeTable: ["user", "workflow"],
  components: {
    BasicModal,
    BasicButton,
    BasicTable,
  },
  data() {
    return {
      selectedStudies: [],
      notifySessions: false,
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
        search: true,
        selectableRows: true,
      }
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
      return [...new Set(this.openStudiesInProject.map(s => s.workflowId))]
        .filter(id => id != null)
        .map(id => {
          const wf = this.$store.getters["table/workflow/get"](id);
          return {
            value: id,
            name: wf?.name ? `${wf.name} (id ${id})` : `Workflow ${id}`,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    studyUserOptions() {
      return [...new Set(this.openStudiesInProject.map(s => s.userId))]
        .filter(id => id != null)
        .map(id => {
          const user = this.$store.getters["table/user/get"](id);
          const parts = user ? [user.firstName, user.lastName].filter(Boolean) : [];
          const name = parts.length ? parts.join(" ")
            : user?.userName || user?.email || `User ${id}`;
          return { value: id, name };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    columns() {
      return [
        { name: "ID", key: "id", sortable: true, width: 1 },
        { name: "Study", key: "name", sortable: true, multiline: true, width: 3 },
        {
          name: "Workflow",
          key: "workflowName",
          sortable: true,
          multiline: true,
          width: 3,
          filter: this.workflowOptions.map((opt) => ({ key: opt.name, name: opt.name })),
        },
        {
          name: "User",
          key: "ownerName",
          sortable: true,
          width: 2,
          filter: this.studyUserOptions.map((opt) => ({ key: opt.name, name: opt.name })),
        },
        {
          name: "Created",
          key: "createdAt",
          sortable: true,
          width: 2,
        },
      ];
    },
    tableRows() {
      return this.openStudiesInProject
        .map((study) => {
          const workflow = this.$store.getters["table/workflow/get"](study.workflowId);
          const user = this.$store.getters["table/user/get"](study.userId);
          const ownerParts = user ? [user.firstName, user.lastName].filter(Boolean) : [];
          const ownerName = ownerParts.length
            ? ownerParts.join(" ")
            : user?.userName || user?.email || `User ${study.userId}`;

          return {
            id: study.id,
            name: study.name || `Study ${study.id}`,
            workflowName: workflow?.name || `Workflow ${study.workflowId ?? "-"}`,
            ownerName,
            createdAt: new Date(study.createdAt).toLocaleString(),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    selectedCount() {
      return this.selectedStudies.length;
    },
    scopeSummary() {
      const n = this.selectedCount;
      if (n === 0) {
        return `No studies selected. Showing ${this.tableRows.length} open studies.`;
      }
      return `${n} ${n === 1 ? "study selected" : "studies selected"} for closing.`;
    },
    confirmButtonTitle() {
      return this.selectedCount === 0
        ? "No studies to close"
        : `Close ${this.selectedCount} ${this.selectedCount === 1 ? "study" : "studies"}`;
    },
  },
  methods: {
    open() {
      this.selectedStudies = [];
      this.notifySessions = false;
      this.$refs.bulkCloseModal.open();
    },
    closeMatchingStudies() {
      const matches = this.selectedStudies;
      if (matches.length === 0) {
        this.eventBus.emit("toast", {
          title: "Nothing to close",
          message: "Select at least one open study from the table.",
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
