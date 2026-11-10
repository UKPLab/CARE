/**
 * Backend side of the Criteria tab (Options API mixin for the dashboard page): the list of criterion
 * versions from `criterionGetAll` and the delete of one version with `criterionDelete`.
 *
 * The page must have a ConfirmModal in `$refs.confirmModal`. A row is only removed from the table by the
 * reload after the backend has confirmed the delete, never before.
 *
 * @author Eyad Mohamed
 */
import { resolveApiMessage } from "@/assets/utils";
import { requestAssessment } from "@/components/dashboard/assessments/assessmentSocket.js";
import { escapeHtml } from "@/components/dashboard/assessments/criterionForm.js";

const messageOf = (error) => resolveApiMessage(error.response ?? { message: error.message });

export default {
  data() {
    return {
      /** Criterion versions from the backend, historical versions included */
      criteria: [],
      criteriaLoading: false,
      criteriaError: "",
      criteriaLoadSeq: 0,
      deletingCriterion: false,
    };
  },
  mounted() {
    this.loadCriteria();
  },
  methods: {
    /**
     * Load every criterion version. Without `force` a running load is not repeated; a reload after a
     * change always runs and only the newest answer is applied. A failed reload keeps the shown rows.
     *
     * @param {{force?: boolean}} [options]
     */
    async loadCriteria({ force = false } = {}) {
      if (this.criteriaLoading && !force) {
        return;
      }
      const seq = ++this.criteriaLoadSeq;
      this.criteriaLoading = true;
      try {
        const criteria = await requestAssessment(this.$socket, "criterionGetAll", {});
        if (seq === this.criteriaLoadSeq) {
          this.criteria = criteria;
          this.criteriaError = "";
        }
      } catch (error) {
        if (seq === this.criteriaLoadSeq) {
          this.criteriaError = messageOf(error);
        }
      } finally {
        if (seq === this.criteriaLoadSeq) {
          this.criteriaLoading = false;
        }
      }
    },
    /** Ask first; the row stays in the table until the backend has confirmed the delete. */
    confirmCriterionDelete(row) {
      if (this.deletingCriterion) {
        return;
      }
      this.$refs.confirmModal.open(
        this.$t("assessmentManagement.confirm.title"),
        this.$t("assessmentManagement.confirm.deleteCriterion", {
          name: escapeHtml(row.name),
          version: escapeHtml(row.versionNumber),
        }),
        null,
        (confirmed) => {
          if (confirmed) {
            this.deleteCriterionVersion(row);
          }
        }
      );
    },
    async deleteCriterionVersion(row) {
      if (this.deletingCriterion) {
        return;
      }
      this.deletingCriterion = true;
      try {
        await requestAssessment(this.$socket, "criterionDelete", { criterionId: row.id });
        this.eventBus.emit("toast", {
          title: this.$t("assessmentManagement.messages.deleted"),
          message: this.$t("assessmentManagement.messages.criterionDeleted", { name: row.name, version: row.versionNumber }),
          variant: "success",
        });
        await this.loadCriteria({ force: true });
      } catch (error) {
        // e.g. a rubric still uses the version: the backend message names the rubrics
        this.eventBus.emit("toast", {
          title: this.$t("assessmentManagement.messages.deleteFailed"),
          message: messageOf(error),
          variant: "danger",
        });
      } finally {
        this.deletingCriterion = false;
      }
    },
  },
};
