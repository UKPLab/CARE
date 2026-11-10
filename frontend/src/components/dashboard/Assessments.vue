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
        :buttons="current.buttons"
        :loading="Boolean(current.loading)"
        :error="current.error || ''"
        :empty-text="current.emptyText || ''"
        @add="openModal(null)"
        @action="onAction"
        @retry="loadCriteria()"
      />
      <p
        v-if="activeTab !== 'criteria'"
        class="text-muted small mt-3 mb-0"
      >
        {{ $t("assessmentManagement.prototypeNote") }}
      </p>
    </template>
  </BasicCard>

  <AssessmentModal ref="assessmentModal" />
  <RubricModal ref="rubricModal" />
  <CriterionModal
    ref="criterionModal"
    :criteria="criteria"
    @saved="loadCriteria({ force: true })"
  />
  <ConfirmModal ref="confirmModal" />
</template>

<script>
/**
 * Assessment management dashboard: assessments, rubrics and criteria in three tabs.
 *
 * The Criteria tab is backed by the database through the criterion* socket events: every criterion
 * version is listed (historical ones too), a version can be viewed, copied into a new version or deleted
 * while no rubric uses it. The Assessments and Rubrics tabs still use the local mock store
 * (assessments/assessmentMockStore.js); nothing they do is saved yet.
 *
 * @author Eyad Mohamed
 */
import BasicCard from "@/basic/dashboard/card/Card.vue";
import BasicButton from "@/basic/Button.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import { dashboardRowAction, dashboardRowButton } from "@/basic/dashboard/actions.js";
import AssessmentTablePanel from "@/components/dashboard/assessments/AssessmentTablePanel.vue";
import AssessmentModal from "@/components/dashboard/assessments/AssessmentModal.vue";
import RubricModal from "@/components/dashboard/assessments/RubricModal.vue";
import CriterionModal from "@/components/dashboard/assessments/CriterionModal.vue";
import { CALCULATION_METHODS } from "@/components/dashboard/assessments/assessmentConstants.js";
import criteriaBackendMixin from "@/components/dashboard/assessments/criteriaBackendMixin.js";
import {
  assessmentState,
  deleteAssessment,
  deleteRubric,
  assessmentsUsingRubric,
} from "@/components/dashboard/assessments/assessmentMockStore.js";

export default {
  name: "DashboardAssessments",
  components: { BasicCard, BasicButton, ConfirmModal, AssessmentTablePanel, AssessmentModal, RubricModal, CriterionModal },
  mixins: [criteriaBackendMixin],
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
    mockRowButtons() {
      return [
        dashboardRowAction("edit", { title: this.$t("assessmentManagement.actions.edit"), action: "edit" }),
        dashboardRowAction("delete", { title: this.$t("assessmentManagement.actions.delete"), action: "delete" }),
      ];
    },
    criterionButtons() {
      return [
        dashboardRowAction("view", { title: this.$t("assessmentManagement.actions.view"), action: "view" }),
        dashboardRowButton("plus-square", { title: this.$t("assessmentManagement.actions.newVersion"), action: "newVersion" }),
        dashboardRowAction("delete", { title: this.$t("assessmentManagement.actions.delete"), action: "delete" }),
      ];
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
          buttons: this.mockRowButtons,
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
          buttons: this.mockRowButtons,
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
          rows: this.criteria,
          buttons: this.criterionButtons,
          loading: this.criteriaLoading,
          error: this.criteriaError,
          emptyText: this.$t("assessmentManagement.criterion.empty"),
          columns: [
            idColumn,
            { name: this.$t("assessmentManagement.fields.group"), key: "criterionGroupId", sortable: true },
            nameColumn,
            { name: this.$t("assessmentManagement.fields.version"), key: "versionNumber", sortable: true },
            { name: this.$t("assessmentManagement.fields.minPoints"), key: "minPoints", sortable: true },
            { name: this.$t("assessmentManagement.fields.maxPoints"), key: "maxPoints", sortable: true },
            { name: this.$t("assessmentManagement.fields.createdAt"), key: "createdAt", type: "datetime", sortable: true },
          ],
        },
      ];
    },
    current() {
      return this.tabs.find((t) => t.key === this.activeTab);
    },
  },
  methods: {
    modalRef() {
      return {
        assessments: this.$refs.assessmentModal,
        rubrics: this.$refs.rubricModal,
      }[this.activeTab];
    },
    /** Prototype tabs: rows carry derived fields, the modals work on the stored record. */
    storedRecord(row) {
      return assessmentState[this.activeTab].find((r) => r.id === row.id);
    },
    openModal(row) {
      if (this.activeTab === "criteria") {
        this.$refs.criterionModal.openCreate();
        return;
      }
      this.modalRef().open(row ? this.storedRecord(row) : null);
    },
    onAction(data) {
      if (this.activeTab === "criteria") {
        this.onCriterionAction(data);
      } else if (data.action === "edit") {
        this.openModal(data.params);
      } else if (data.action === "delete") {
        this.confirmDelete(data.params);
      }
    },
    onCriterionAction({ action, params }) {
      if (action === "view") {
        this.$refs.criterionModal.openView(params.id);
      } else if (action === "newVersion") {
        this.$refs.criterionModal.openNewVersion(params.id);
      } else if (action === "delete") {
        this.confirmCriterionDelete(params);
      }
    },
    confirmDelete(row) {
      const messages = {
        assessments: () => this.$t("assessmentManagement.confirm.deleteAssessment", { name: row.name }),
        rubrics: () => this.$t("assessmentManagement.confirm.deleteRubric", { name: row.name }),
      };
      const warnings = {
        assessments: () => null,
        rubrics: () => this.usageWarning(assessmentsUsingRubric(row.id).length),
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
          ({ assessments: deleteAssessment, rubrics: deleteRubric })[tab](row.id);
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
