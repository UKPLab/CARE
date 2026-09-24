<template>
  <StepperModal
      ref="assignStepper"
      :steps="steps"
      :validation="stepValid"
      @submit="assignGroup"
  >
    <template #title>
      <h5 class="modal-title">{{ $t('dashboard.submission.assignGroup.title') }}</h5>
    </template>

    <template #step-1>
      <div class="step-1-header w-100">
        <div class="percentage-control w-100">
          <label class="form-label mb-1">
            {{ $t('dashboard.submission.assignGroup.applyPercentage') }}
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
              {{ $t('dashboard.submission.assignGroup.targetCount', {
                percentage: selectionPercentage,
                target: selectionTargetCount,
                total: selectedSubmissions.length
              }) }}
            </span>

            <BasicButton
                class="btn btn-sm btn-outline-primary text-nowrap"
                :text="$t('dashboard.submission.assignGroup.applyButton')"
                :disabled="selectedSubmissions.length === 0"
                @click="applySelectionPercentage"
            />
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
        <h6>{{ $t('dashboard.submission.assignGroup.summaryTitle') }}</h6>
        <div class="summary-item"><strong>{{ $t('dashboard.submission.assignGroup.numberOfSubmissions') }}</strong> {{ selectedSubmissions.length }}</div>
        <div class="summary-item"><strong>{{ $t('dashboard.submission.assignGroup.groupNumberLabel') }}</strong> {{ data.group }}</div>
        <div class="summary-item"><strong>{{ $t('dashboard.submission.assignGroup.additionalSettingsLabel') }}</strong> {{ data.settings ?? $t('common.na') }}</div>
        <div class="summary-item"><strong>{{ $t('dashboard.submission.assignGroup.copySubmissionsLabel') }}</strong> {{ data.copySubmissions ? $t('common.yes') : $t('common.no') }}</div>
        <div class="alert alert-info mt-3">
          <i class="bi bi-info-circle"></i>
          {{ $t('dashboard.submission.assignGroup.reviewNote') }}
        </div>
      </div>
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";
import BasicForm from "@/basic/Form.vue";
import { formatLocalizedDate, resolveApiMessage } from "@/assets/utils";

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
  components: {BasicForm, BasicTable, StepperModal, BasicButton},
  subscribeTable: ["submission", "user", "document", "document_data"],
  data() {
    return {
      selectedSubmissions: [],
      data: {
        group: null,
        settings: "",
        copySubmissions: false,
      },
      selectionPercentage: 100,
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
        pagination: 10,
      },
    };
  },
  computed: {
    steps() {
      return [
        { title: this.$t('dashboard.submission.assignGroup.stepOne') },
        { title: this.$t('dashboard.submission.assignGroup.stepTwo') },
        { title: this.$t('dashboard.submission.assignGroup.stepThree') },
      ];
    },
    formFields() {
      return [
        {
          key: "group",
          label: this.$t('dashboard.submission.assignGroup.groupNumber'),
          type: "number",
          placeholder: this.$t('dashboard.submission.assignGroup.groupNumberPlaceholder'),
          min: 0,
          class: "form-control",
          required: true,
          default: null,
        },
        {
          key: "settings",
          label: this.$t('dashboard.submission.assignGroup.additionalSettings'),
          type: "textarea",
          placeholder: this.$t('dashboard.submission.assignGroup.additionalSettingsPlaceholder'),
          class: "form-control",
          default: "",
        },
        {
          key: "copySubmissions",
          label: this.$t('dashboard.submission.assignGroup.copySubmissions'),
          type: "checkbox",
          required: true,
          options: [
            {
              label: this.$t('dashboard.submission.assignGroup.createCopyiesOfSubmissionsLabel'),
              value: true,
            },
          ],
        },
      ];
    },
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
        const documents = this.$store.getters["table/document/getByKey"]('submissionId', s.id);
        const docIds = documents.map(d => d.id);
        const dataExists = docIds.some(docId => this.$store.getters["table/document_data/getByKey"]('documentId', docId).length > 0);
        return {
          id: s.id,
          firstName: user.firstName,
          lastName: user.lastName,
          group: s.group ?? "-",
          data_existing: dataExists ? this.$t('common.yes') : this.$t('common.no'),
          createdAt: formatLocalizedDate(s.createdAt),
          additionalSettings: s.additionalSettings
              ? {icon: "gear-fill", color: "blue", title: s.additionalSettings}
              : {icon: "gear", color: "gray", title: this.$t('submission.assign.noAdditionalSettings')},
        };
      });
    },
    submissionColumns() {
      return [
        {name: this.$t('common.firstName'), key: "firstName", sortable: true},
        {name: this.$t('common.lastName'), key: "lastName", sortable: true},
        {name: this.$t('common.groupId'), key: "group", sortable: true, filter: this.groupFilterOptions},
        {name: this.$t('common.dataExisting'), key: "data_existing", sortable: true, filter: this.dataExistingFilterOptions},
        {name: this.$t('common.createdAt'), key: "createdAt", sortable: true},
        {name: this.$t('dashboard.submission.assignGroup.columns.additionalSettings'), key: "additionalSettings", type: "icon", sortable: false},
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
        options.unshift({key: '', name: this.$t('dashboard.submission.assignGroup.filters.noGroupId')});
      }

      return options;
    },
    dataExistingFilterOptions() {
      const options = new Set();
      (this.submissionTable || []).forEach((s) => {
        options.add(String(s.data_existing));
      });
      return Array.from(options)
          .sort()
          .map((val) => ({key: val, name: val}));
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
            title: this.$t('dashboard.submission.assignGroup.successTitle'),
            message: this.$t('dashboard.submission.assignGroup.successMessage', {
              count: submissionIds.length,
              group: this.data.group
            }),
            variant: "success",
          });
          this.$refs.assignStepper.close();
        } else {
          this.eventBus.emit("toast", {
            title: this.$t('dashboard.submission.assignGroup.failureTitle'),
            message: resolveApiMessage(res),
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
