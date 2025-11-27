<template>
  <StepperModal
      ref="assignStepper"
      :steps="steps"
      :validation="stepValid"
      @submit="assignGroup"
  >
    <template #title>
      <h5 class="modal-title">Assign Group</h5>
    </template>

    <template #step-1>
      <div class="step-1-header w-100">
        <div class="percentage-control w-100">
          <label class="form-label mb-1">
            Apply percentage of current selection (randomly chosen):
          </label>

          <div class="d-flex align-items-center gap-2 w-100">
            <input
                v-model.number="selectionPercentage"
                type="range"
                min="1"
                max="100"
                class="flex-grow-1"
            />
            <span class="small text-muted text-nowrap">
              {{ selectionPercentage }}% → {{ selectionTargetCount }} of {{ selectedSubmissions.length }}
            </span>

            <button
                type="button"
                class="btn btn-sm btn-outline-primary text-nowrap"
                :disabled="selectedSubmissions.length === 0"
                @click="applySelectionPercentage"
            >
              Apply
            </button>
          </div>

        </div>
      </div>
      <div class="mt-2">
        <BasicTable
          v-model="selectedSubmissions"
          :columns="submissionColumns"
          :options="submissionTableOptions"
          :data="submissionTable"
          :max-table-height="400"
        />
      </div>
    </template>

    <template #step-2>
      <BasicForm
          v-model="data"
          :fields="formFields"
      />
    </template>
    <template #step-3>
      <div class="summary-container">
        <h6>Assignment Summary</h6>
        <div class="summary-item"><strong>Number of Submissions:</strong> {{ selectedSubmissions.length }}</div>
        <div class="summary-item"><strong>Group Number:</strong> {{ data.group }}</div>
        <div class="summary-item"><strong>Additional Settings:</strong> {{ data.settings ?? "N/A" }}</div>
        <div class="summary-item"><strong>Copy Submissions:</strong> {{ data.copySubmissions ? "Yes" : "No" }}</div>
        <div class="alert alert-info mt-3">
          <i class="bi bi-info-circle"></i>
          Please review the information above before submitting.
        </div>
      </div>
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicTable from "@/basic/Table.vue";
import BasicForm from "@/basic/Form.vue";

/**
 * Submission group modal component
 *
 * This component provides the functionality for assigning submissions
 * to a group with additional settings and optional copying.
 *
 * @author: Linyin Huang
 */
export default {
  name: "AssignModal",
  components: {BasicForm, BasicTable, StepperModal},
  subscribeTable: ["submission", "user", "document"],
  data() {
    return {
      selectedSubmissions: [],
      data: {
        group: null,
        settings: "",
        copySubmissions: false,
      },
      selectionPercentage: 100,
      steps: [{title: "Select Submissions"}, {title: "Group Settings"}, {title: "Review & Confirm"}],
      formFields: [
        {
          key: "group",
          label: "Group Number",
          type: "number",
          placeholder: "Enter group number",
          min: 0,
          class: "form-control",
          required: true,
          default: null,
        },
        {
          key: "settings",
          label: "Additional Settings",
          type: "textarea",
          placeholder: "Enter any additional settings",
          class: "form-control",
          default: "",
        },
        {
          key: "copySubmissions",
          label: "Copy Submissions",
          type: "checkbox",
          required: true,
          options: [
            {
              label: "Create copies of the selected submissions with the specified group number.",
              value: true,
            },
          ],
        },
      ],
      submissionTableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        scrollY: true,
        scrollX: true,
        singleSelect: false,
        search: true,
      },
    };
  },
  computed: {
    selectionTargetCount() {
      if (!this.selectedSubmissions.length) return 0;
      const raw = (this.selectedSubmissions.length * this.selectionPercentage) / 100;
      return Math.max(1, Math.round(raw)); // always keep at least 1 if there is any selection
    },
    submissions() {
      return this.$store.getters["table/submission/getAll"];
    },
    submissionTable() {
      return this.submissions.map((s) => {
        const user = this.$store.getters["table/user/get"](s.userId);
        return {
          id: s.id,
          firstName: user.firstName,
          lastName: user.lastName,
          group: s.group ?? "-",
          createdAt: new Date(s.createdAt).toLocaleDateString(),
          additionalSettings: s.additionalSettings
              ? {icon: "gear-fill", color: "blue", title: s.additionalSettings}
              : {icon: "gear", color: "gray", title: "No additional settings"},
        };
      });
    },
    submissionColumns() {
      return [
        {name: "First Name", key: "firstName", sortable: true},
        {name: "Last Name", key: "lastName", sortable: true},
        {name: "Group", key: "group", sortable: true, filter: this.groupFilterOptions},
        {name: "Created At", key: "createdAt", sortable: true},
        {name: "Additional Settings", key: "additionalSettings", type: "icon", sortable: false},
      ];
    },
    groupFilterOptions() {
      const groups = new Set();
      let hasEmptyGroups = false;

      (this.submissionTable || []).forEach((s) => {
        if (s && s.group !== null && s.group !== undefined && s.group !== '') {
          groups.add(String(s.group));
        } else {
          hasEmptyGroups = true;
        }
      });

      const options = Array.from(groups)
          .sort((a, b) => {
            const na = Number(a);
            const nb = Number(b);
            if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
            return a.localeCompare(b);
          })
          .map((g) => ({key: g, name: g}));

      if (hasEmptyGroups) {
        options.unshift({key: '', name: 'No GroupID'});
      }

      return options;
    },
    stepValid() {
      return [
        this.selectedSubmissions.length > 0,
        this.data.group !== null && this.data.group !== "",
        true, // Step 3 is always valid (just review)
      ];
    },
  },
  methods: {
    open() {
      this.selectedSubmissions = [];
      this.data = {
        group: null,
        settings: "",
        copySubmissions: false,
      };
      this.$refs.assignStepper.open();
    },
    applySelectionPercentage() {
      const total = this.selectedSubmissions.length;
      if (!total) return;

      const target = this.selectionTargetCount;

      // 1) Take the currently selected IDs
      const selectedIds = this.selectedSubmissions.map(s => s.id);

      // 2) Shuffle IDs and keep only the first N
      const shuffledIds = [...selectedIds].sort(() => Math.random() - 0.5);
      const keepIds = new Set(shuffledIds.slice(0, target));

      // 3) Rebuild selection from the *current* table rows
      this.selectedSubmissions = this.submissionTable.filter(row =>
          keepIds.has(row.id)
      );
    },
    assignGroup() {
      this.$refs.assignStepper.setWaiting(true);

      const submissionIds = this.selectedSubmissions.map((s) => s.id);

      const requestParams = {
        submissionIds: submissionIds,
        group: this.data.group,
        additionalSettings: this.data.settings,
        isCopied: this.data.copySubmissions,
      };

      this.$socket.emit("submissionAssignGroup", requestParams, (res) => {
        if (res.success) {
          this.eventBus.emit("toast", {
            title: "Group Assigned",
            message: `Successfully assigned ${submissionIds.length} submission(s) to group ${this.data.group}`,
            variant: "success",
          });
          this.$refs.assignStepper.close();
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to assign group",
            message: res.message,
            variant: "danger",
          });
          this.$refs.assignStepper.setWaiting(false);
        }
      });
    },
  },
};
</script>

<style scoped>
.summary-container {
  padding: 1rem;
}

.summary-item {
  padding: 0.5rem 0;
  border-bottom: 1px solid #e9ecef;
}

.summary-item:last-of-type {
  border-bottom: none;
}

.summary-item strong {
  display: inline-block;
  min-width: 180px;
  color: #495057;
}
</style>
