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
        :loading="current.loading"
        :error="current.error"
        :empty-text="current.emptyText"
        @add="openCreate"
        @action="onAction"
        @retry="loadVersioned(current.kind)"
      />
    </template>
  </BasicCard>

  <AssessmentModal
    ref="assessmentModal"
    @saved="loadVersioned('assessment', { force: true })"
  />
  <RubricModal
    ref="rubricModal"
    @saved="loadVersioned('rubric', { force: true })"
  />
  <CriterionModal
    ref="criterionModal"
    @saved="loadVersioned('criterion', { force: true })"
  />
  <!-- Versions modals: the read-only view of a version opens in the modal placed inside, so it nests above it -->
  <VersionsModal
    ref="assessmentVersionsModal"
    kind="assessment"
    kind-label="assessmentManagement.kinds.assessment"
    @view="viewVersion('assessment', $event)"
    @changed="loadVersioned('assessment', { force: true })"
  >
    <AssessmentModal ref="assessmentViewModal" />
  </VersionsModal>
  <VersionsModal
    ref="rubricVersionsModal"
    kind="rubric"
    kind-label="assessmentManagement.kinds.rubric"
    @view="viewVersion('rubric', $event)"
    @changed="loadVersioned('rubric', { force: true })"
  >
    <RubricModal ref="rubricViewModal" />
  </VersionsModal>
  <VersionsModal
    ref="criterionVersionsModal"
    kind="criterion"
    kind-label="assessmentManagement.kinds.criterion"
    @view="viewVersion('criterion', $event)"
    @changed="loadVersioned('criterion', { force: true })"
  >
    <CriterionModal ref="criterionViewModal" />
  </VersionsModal>
</template>

<script>
/**
 * Assessment management dashboard: assessments, rubrics and criteria in three tabs, all backed by the database
 * through the assessment*, rubric* and criterion* socket events.
 *
 * Each tab lists one row per assessment / rubric / criterion: its latest version with the number of versions.
 * A row can be viewed (read-only), copied into a new version (version numbers are assigned by the backend) or
 * opened in the Versions modal, where one version can be viewed or deleted. There is no Delete in the tables.
 * Deleting an assessment version is disabled for now (the Versions modal says so and sends nothing).
 *
 * @author Eyad Mohamed
 */
import BasicCard from "@/basic/dashboard/card/Card.vue";
import BasicButton from "@/basic/Button.vue";
import { dashboardRowAction, dashboardRowButton } from "@/basic/dashboard/actions.js";
import AssessmentTablePanel from "@/components/dashboard/assessments/AssessmentTablePanel.vue";
import AssessmentModal from "@/components/dashboard/assessments/AssessmentModal.vue";
import RubricModal from "@/components/dashboard/assessments/RubricModal.vue";
import CriterionModal from "@/components/dashboard/assessments/CriterionModal.vue";
import VersionsModal from "@/components/dashboard/assessments/VersionsModal.vue";
import { calculationOptions } from "@/components/dashboard/assessments/assessmentConstants.js";
import versionedBackendMixin from "@/components/dashboard/assessments/versionedBackendMixin.js";

/** Tab key → kind of the backend events */
const KIND_OF_TAB = { assessments: "assessment", rubrics: "rubric", criteria: "criterion" };

export default {
  name: "DashboardAssessments",
  components: { BasicCard, BasicButton, AssessmentTablePanel, AssessmentModal, RubricModal, CriterionModal, VersionsModal },
  mixins: [versionedBackendMixin],
  data() {
    return {
      activeTab: "assessments",
    };
  },
  computed: {
    rowButtons() {
      return [
        dashboardRowAction("view", { title: this.$t("assessmentManagement.actions.view"), action: "view" }),
        dashboardRowButton("plus-square", { title: this.$t("assessmentManagement.actions.newVersion"), action: "newVersion" }),
        dashboardRowButton("clock-history", { title: this.$t("assessmentManagement.actions.versions"), action: "versions" }),
      ];
    },
    /** Rubric rows with the readable calculation (an older stored value is shown as it is, or as its legacy name) */
    rubricRows() {
      return this.lists.rubric.rows.map((row) => {
        const method = calculationOptions(row.calculation).find((m) => m.value === row.calculation);
        return { ...row, calculationLabel: method?.labelKey ? this.$t(method.labelKey) : (row.calculation ?? "") };
      });
    },
    tabs() {
      const common = (tabKey, text, rows) => {
        const kind = KIND_OF_TAB[tabKey];
        const list = this.lists[kind];
        return {
          key: tabKey,
          kind,
          label: this.$t(`assessmentManagement.tabs.${tabKey}`),
          panelTitle: this.$t(`assessmentManagement.${kind}.listTitle`),
          addLabel: this.$t(`assessmentManagement.${kind}.add`),
          emptyText: this.$t(`assessmentManagement.${kind}.empty`),
          rows,
          loading: list.loading,
          error: list.error,
          ...text,
        };
      };
      const column = (key, label, extra = {}) => ({ name: this.$t(`assessmentManagement.fields.${label}`), key, sortable: true, ...extra });
      const versionColumns = [column("versionNumber", "latestVersion"), column("versionCount", "versions")];
      const created = column("createdAt", "createdAt", { type: "datetime" });
      return [
        common("assessments", {
          columns: [column("name", "name"), column("description", "description"), ...versionColumns, created],
        }, this.lists.assessment.rows),
        common("rubrics", {
          columns: [
            column("name", "name"), column("description", "description"), ...versionColumns,
            column("calculationLabel", "calculation"), column("minPoints", "minPoints"), column("maxPoints", "maxPoints"), created,
          ],
        }, this.rubricRows),
        common("criteria", {
          columns: [
            column("name", "name"), column("description", "description"), ...versionColumns,
            column("minPoints", "minPoints"), column("maxPoints", "maxPoints"), created,
          ],
        }, this.lists.criterion.rows),
      ];
    },
    current() {
      return this.tabs.find((t) => t.key === this.activeTab);
    },
  },
  methods: {
    /** The create/view modal of the active tab */
    modalOf(kind) {
      return this.$refs[`${kind}Modal`];
    },
    openCreate() {
      this.modalOf(this.current.kind).openCreate();
    },
    /** All three actions work on the latest version of the row; `versions` opens the history of its group. */
    onAction({ action, params }) {
      const { kind } = this.current;
      if (action === "view") {
        this.modalOf(kind).openView(params.id);
      } else if (action === "newVersion") {
        this.modalOf(kind).openNewVersion(params.id);
      } else if (action === "versions") {
        this.openVersions(kind, params);
      }
    },
  },
};
</script>
