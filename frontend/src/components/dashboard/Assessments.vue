<template>
  <BasicCard :title="$t('assessmentManagement.title')">
    <template #body>
      <ul class="nav nav-tabs mb-3">
        <li
          v-for="tab in tabs"
          :key="tab.key"
          class="nav-item"
        >
          <BasicButton
            class="nav-link"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
            <span class="badge bg-secondary ms-1">{{ tab.rows.length }}</span>
          </BasicButton>
        </li>
      </ul>
      <AssessmentTablePanel
        :key="activeTab"
        :title="current.panelTitle"
        :add-label="current.addLabel"
        :columns="current.columns"
        :data="current.rows"
        :buttons="rowButtons"
        @add="openModal(null)"
        @action="onAction"
      />
      <p class="text-muted small mt-3 mb-0">
        {{ $t("assessmentManagement.prototypeNote") }}
      </p>
    </template>
  </BasicCard>

  <AssessmentModal ref="assessmentModal" />
  <RubricModal ref="rubricModal" />
  <CriterionModal ref="criterionModal" />
  <ConfirmModal ref="confirmModal" />
</template>

<script>
/**
 * Assessment management dashboard (prototype): assessments, rubrics and criteria
 * in three tabs, each with a two-step add/edit modal.
 *
 * All data comes from the local mock store (assessments/assessmentMockStore.js);
 * nothing is saved to the database yet.
 *
 * @author Eyad Mohamed
 */
import BasicCard from "@/basic/dashboard/card/Card.vue";
import BasicButton from "@/basic/Button.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import { dashboardRowAction } from "@/basic/dashboard/actions.js";
import AssessmentTablePanel from "@/components/dashboard/assessments/AssessmentTablePanel.vue";
import AssessmentModal from "@/components/dashboard/assessments/AssessmentModal.vue";
import RubricModal from "@/components/dashboard/assessments/RubricModal.vue";
import CriterionModal from "@/components/dashboard/assessments/CriterionModal.vue";
import { CALCULATION_METHODS } from "@/components/dashboard/assessments/assessmentConstants.js";
import {
  assessmentState,
  deleteAssessment,
  deleteRubric,
  deleteCriterion,
  assessmentsUsingRubric,
  rubricsUsingCriterion,
} from "@/components/dashboard/assessments/assessmentMockStore.js";

export default {
  name: "DashboardAssessments",
  components: { BasicCard, BasicButton, ConfirmModal, AssessmentTablePanel, AssessmentModal, RubricModal, CriterionModal },
  data() {
    return {
      activeTab: "assessments",
    };
  },
  computed: {
    assessmentRows() {
      return assessmentState.assessments.map((a) => ({ ...a, rubricCount: a.rubricIds.length }));
    },
    rubricRows() {
      return assessmentState.rubrics.map((r) => {
        const method = CALCULATION_METHODS.find((m) => m.value === r.calculation);
        return {
          ...r,
          calculationLabel: method ? this.$t(method.labelKey) : r.calculation,
          criterionCount: r.criterionIds.length,
        };
      });
    },
    criterionRows() {
      return assessmentState.criteria.map((c) => ({
        ...c,
        rubricCount: rubricsUsingCriterion(c.id).length,
      }));
    },
    tabs() {
      const idColumn = { name: this.$t("assessmentManagement.fields.id"), key: "id", sortable: true };
      const nameColumn = { name: this.$t("assessmentManagement.fields.name"), key: "name", sortable: true };
      const codeColumn = { name: this.$t("assessmentManagement.fields.code"), key: "code", sortable: true };
      return [
        {
          key: "assessments",
          label: this.$t("assessmentManagement.tabs.assessments"),
          panelTitle: this.$t("assessmentManagement.assessment.listTitle"),
          addLabel: this.$t("assessmentManagement.assessment.add"),
          rows: this.assessmentRows,
          columns: [
            idColumn,
            nameColumn,
            { name: this.$t("assessmentManagement.fields.description"), key: "description", sortable: true },
            { name: this.$t("assessmentManagement.fields.version"), key: "version", sortable: true },
            { name: this.$t("assessmentManagement.fields.rubrics"), key: "rubricCount", sortable: true },
          ],
        },
        {
          key: "rubrics",
          label: this.$t("assessmentManagement.tabs.rubrics"),
          panelTitle: this.$t("assessmentManagement.rubric.listTitle"),
          addLabel: this.$t("assessmentManagement.rubric.add"),
          rows: this.rubricRows,
          columns: [
            idColumn,
            codeColumn,
            nameColumn,
            { name: this.$t("assessmentManagement.fields.calculation"), key: "calculationLabel", sortable: true },
            { name: this.$t("assessmentManagement.fields.criteria"), key: "criterionCount", sortable: true },
          ],
        },
        {
          key: "criteria",
          label: this.$t("assessmentManagement.tabs.criteria"),
          panelTitle: this.$t("assessmentManagement.criterion.listTitle"),
          addLabel: this.$t("assessmentManagement.criterion.add"),
          rows: this.criterionRows,
          columns: [
            idColumn,
            codeColumn,
            nameColumn,
            { name: this.$t("assessmentManagement.fields.minPoints"), key: "minPoints", sortable: true },
            { name: this.$t("assessmentManagement.fields.maxPoints"), key: "maxPoints", sortable: true },
            { name: this.$t("assessmentManagement.fields.rubrics"), key: "rubricCount", sortable: true },
          ],
        },
      ];
    },
    current() {
      return this.tabs.find((t) => t.key === this.activeTab);
    },
    rowButtons() {
      return [
        dashboardRowAction("edit", { title: this.$t("assessmentManagement.actions.edit"), action: "edit" }),
        dashboardRowAction("delete", { title: this.$t("assessmentManagement.actions.delete"), action: "delete" }),
      ];
    },
  },
  methods: {
    modalRef() {
      return {
        assessments: this.$refs.assessmentModal,
        rubrics: this.$refs.rubricModal,
        criteria: this.$refs.criterionModal,
      }[this.activeTab];
    },
    /** Rows carry derived display fields; the modals work on the stored record. */
    storedRecord(row) {
      // Tab keys match the collection names in the store
      return assessmentState[this.activeTab].find((r) => r.id === row.id);
    },
    openModal(row) {
      this.modalRef().open(row ? this.storedRecord(row) : null);
    },
    onAction(data) {
      if (data.action === "edit") {
        this.openModal(data.params);
      } else if (data.action === "delete") {
        this.confirmDelete(data.params);
      }
    },
    confirmDelete(row) {
      const messages = {
        assessments: () => this.$t("assessmentManagement.confirm.deleteAssessment", { name: row.name }),
        rubrics: () => this.$t("assessmentManagement.confirm.deleteRubric", { name: row.name }),
        criteria: () => this.$t("assessmentManagement.confirm.deleteCriterion", { name: row.name }),
      };
      const warnings = {
        assessments: () => null,
        rubrics: () => this.usageWarning(assessmentsUsingRubric(row.id).length),
        criteria: () => this.usageWarning(rubricsUsingCriterion(row.id).length),
      };
      const tab = this.activeTab;
      this.$refs.confirmModal.open(
        this.$t("assessmentManagement.confirm.title"),
        messages[tab](),
        warnings[tab](),
        (confirmed) => {
          if (!confirmed) {
            return;
          }
          ({ assessments: deleteAssessment, rubrics: deleteRubric, criteria: deleteCriterion })[tab](row.id);
          this.eventBus.emit("toast", {
            title: this.$t("assessmentManagement.messages.deleted"),
            message: this.$t("assessmentManagement.messages.recordDeleted", { name: row.name }),
            variant: "success",
          });
        }
      );
    },
    usageWarning(count) {
      return count > 0 ? this.$t("assessmentManagement.confirm.usedBy", { count }) : null;
    },
  },
};
</script>
