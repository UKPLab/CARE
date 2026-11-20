<template>
  <StepperModal
    ref="manageStudiesModal"
    :steps="steps"
    :validation="stepValid"
    size="xl"
    @submit="handleSubmit"
    @hide="onHide">

    <template #title>
      <h5 class="modal-title">{{ $t('dashboard.study.manageTitle') }}</h5>
    </template>

    <template #step-1>
      <div class="mode-selection-container">
        <h5 class="mb-3">{{ $t('dashboard.study.selectAction') }}</h5>
        <p class="text-muted mb-4">
          {{ $t('dashboard.study.selectActionHint') }}
        </p>
        <BasicForm
          v-model="selectedMode"
          class="mb-3"
          :fields="modeSelectionFields"
        />
      </div>

    </template>

    <template #step-2>
      <ManageStudiesSelectStep
        v-model="selection"
        v-model:workflow-filter="workflowFilter"
        :mode="selectedMode.mode"
      />
    </template>

    <template #step-3>
      <ManageStudiesConfirmStep
        v-model:notification-settings="notificationSettings"
        :mode="selectedMode.mode"
        :selection="selection"
        :workflow-filter="workflowFilter"
      />
    </template>
  </StepperModal>
  <ConfirmModal ref="deleteConf"/>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import BasicForm from "@/basic/Form.vue";
import ManageStudiesSelectStep from "./ManageStudiesSelectStep.vue";
import ManageStudiesConfirmStep from "./ManageStudiesConfirmStep.vue";
import { resolveApiMessage } from "@/assets/utils";
import { emptySelection } from "@/basic/table/emptySelection.js";

/**
 * One bulk action per mode. Everything that differs between close / open / delete is a string,
 * so the three flows share one emit + toast path.
 */
const BULK_ACTIONS = {
  bulkClose: {
    event: "studyCloseBulk",
    countKey: "closedCount",
    emptyTitleKey: "dashboard.study.nothingToClose",
    emptyMessageKey: "dashboard.study.selectOpenStudy",
    doneTitleKey: "dashboard.study.closedTitle",
    doneMessageKey: "dashboard.study.closedMessage",
    unchangedTitleKey: "dashboard.study.closeFinishedTitle",
    unchangedMessageKey: "dashboard.study.noneClosed",
    failTitleKey: "dashboard.study.closeFailed",
  },
  bulkOpen: {
    event: "studyOpenBulk",
    countKey: "openedCount",
    emptyTitleKey: "dashboard.study.nothingToOpen",
    emptyMessageKey: "dashboard.study.selectStudy",
    doneTitleKey: "dashboard.study.openedTitle",
    doneMessageKey: "dashboard.study.openedMessage",
    unchangedTitleKey: "dashboard.study.openFinishedTitle",
    unchangedMessageKey: "dashboard.study.noneOpened",
    failTitleKey: "dashboard.study.openFailed",
  },
  bulkDelete: {
    event: "studyDeleteBulk",
    countKey: "deletedCount",
    emptyTitleKey: "dashboard.study.nothingToDelete",
    emptyMessageKey: "dashboard.study.selectStudy",
    doneTitleKey: "dashboard.study.deletedTitle",
    doneMessageKey: "dashboard.study.deletedMessage",
    unchangedTitleKey: "dashboard.study.deleteFinishedTitle",
    unchangedMessageKey: "dashboard.study.noneDeleted",
    failTitleKey: "dashboard.study.deleteFailed",
  },
};

/**
 * Modal for bulk closing, opening, or deleting studies
 *
 * The list runs on queryTable (issue #88): studies are never pulled into Vuex here. Select-all
 * therefore means "every row this query matches" — the server resolves it again from the same
 * filter, search and exclusions.
 *
 * @author: Dennis Zyska
 */
export default {
  name: "BulkCloseModal",
  // Workflow names for the dropdown labels and the Workflow column; studies come from queryTable.
  subscribeTable: ["workflow"],
  components: {
    StepperModal,
    BasicForm,
    ManageStudiesSelectStep,
    ManageStudiesConfirmStep,
    ConfirmModal,
  },
  emits: ["hide"],
  data() {
    return {
      selectedMode: { mode: null },
      selection: emptySelection(),
      notificationSettings: { notifySessions: false },
      workflowFilter: "all",
    };
  },
  computed: {
    modeSelectionFields() {
      return [
        {
          key: "mode",
          type: "checkbox",
          selectionMode: "single",
          options: [
            { value: "bulkClose", label: this.$t("dashboard.study.closeStudies") },
            { value: "bulkOpen", label: this.$t("dashboard.study.openStudies") },
            { value: "bulkDelete", label: this.$t("dashboard.study.deleteStudies") },
          ],
        },
      ];
    },
    steps() {
        return [
          { title: this.$t("dashboard.study.selectAction") },
          { title: this.$t("dashboard.study.selectStudies") },
          {
            title: this.selectedMode.mode === "bulkDelete"
              ? this.$t("dashboard.study.confirmDelete")
              : this.selectedMode.mode === "bulkClose"
                ? this.$t("dashboard.study.confirmClose")
                : this.selectedMode.mode === "bulkOpen"
                  ? this.$t("dashboard.study.confirmOpen")
                  : this.$t("dashboard.study.confirm"),
          },
        ];
    },
    stepValid() {
      return [
        this.selectedMode.mode !== null, // Step 1 - mode selected
        this.selectedCount > 0, // Step 2 - at least one study selected
        true, // Step 3 - confirm delete if applicable
      ];
    },
    selectedCount() {
      return this.selection.count;
    },
  },
  watch: {
    "selectedMode.mode"(mode, previous) {
      if (previous == null || mode === previous) return;
      this.selection = emptySelection();
    },
  },
  methods: {
    open() {
      this.selectedMode = { mode: null };
      this.selection = emptySelection();
      this.workflowFilter = "all";
      this.notificationSettings = { notifySessions: false };
      this.$refs.manageStudiesModal.open();
    },
    onHide() {
      // Back to step 1 so the query-mode table unmounts with the modal instead of staying
      // subscribed to study deltas while hidden.
      this.$refs.manageStudiesModal?.reset();
      this.$emit("hide");
    },
    /**
     * What the server should act on: either the ids the user ticked, or the query itself plus the
     * rows unticked after select-all.
     * @returns {Object|null} null when nothing is selected
     */
    buildBulkPayload() {
      if (this.selectedCount <= 0) {
        return null;
      }
      if (this.selection.allMatching) {
        return {
          selection: {
            allMatching: true,
            excludeIds: this.selection.excludeIds,
            filter: this.selection.filter,
            query: this.selection.query,
          },
        };
      }
      return {studyIds: this.selection.ids};
    },
    handleSubmit() {
      const mode = this.selectedMode.mode;
      const action = BULK_ACTIONS[mode];
      if (!action) {
        return;
      }
      const payload = this.buildBulkPayload();
      if (!payload) {
        this.eventBus.emit("toast", {
          title: this.$t(action.emptyTitleKey),
          message: this.$t(action.emptyMessageKey),
          variant: "warning",
        });
        return;
      }
      if (mode === "bulkClose") {
        payload.notifySessions = this.notificationSettings.notifySessions;
      }

      if (mode !== "bulkDelete") {
        this.runBulk(action, payload);
        return;
      }
      // Keep the stepper open so startProgress() is visible after ConfirmModal closes.
      // Closing it first left the progress bar on a hidden modal (delete looked "background").
      this.$refs.deleteConf.open(
        this.$t("dashboard.study.deleteStudies"),
        "",
        this.$t("dashboard.study.deleteConfirmPrompt"),
        (confirmed) => {
          if (confirmed) {
            this.runBulk(action, payload);
          }
        }
      );
    },
    runBulk(action, payload) {
      const data = {
        ...payload,
        progressId: this.$refs.manageStudiesModal.getProgressId(),
      };
      this.$refs.manageStudiesModal.startProgress();
      this.$socket.emit(action.event, data, (res) => {
        this.$refs.manageStudiesModal.stopProgress();
        if (res.success) {
          const count = res.data?.[action.countKey] ?? 0;
          this.eventBus.emit("toast", {
            title: this.$t(count > 0 ? action.doneTitleKey : action.unchangedTitleKey),
            message: count > 0
              ? this.$t(action.doneMessageKey, { count })
              : this.$t(action.unchangedMessageKey),
            variant: count > 0 ? "success" : "info",
          });
          this.$refs.manageStudiesModal.close();
        } else {
          this.eventBus.emit("toast", {
            title: this.$t(action.failTitleKey),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      });
    },
  },

};
</script>

<style scoped>
.mode-selection-container {
  padding: 1.5rem;
  background-color: var(--bs-tertiary-bg, #f8f9fa);
  border-radius: 0.25rem;
  border-left: 4px solid var(--care-primary);
}

.mode-selection-container h5 {
  color: var(--bs-body-color, #333);
  font-weight: 600;
}
</style>
