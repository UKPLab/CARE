/**
 * Backend side of the three tabs of the Assessment Management Dashboard (Options API mixin for the page): the
 * latest version of every assessment, rubric and criterion (`<kind>GetLatest`, with the number of versions) and the
 * glue to the shared Versions modals.
 *
 * The page needs, for each kind (`assessment`, `rubric`, `criterion`), `$refs.<kind>VersionsModal` (VersionsModal)
 * and `$refs.<kind>ViewModal` (the read-only modal of that kind, placed inside the Versions modal's slot). There is
 * no delete in the tables: a version is deleted in the Versions modal, after which the table is reloaded so the
 * latest version and the count come from the backend.
 *
 * @author Eyad Mohamed
 */
import { failureText } from "@/components/dashboard/assessments/failureMessage.js";
import { requestAssessment } from "@/components/dashboard/assessments/assessmentSocket.js";

const KINDS = ["assessment", "rubric", "criterion"];

const messageOf = (error, vm) => failureText(error, vm);

export default {
  data() {
    return {
      /** Per kind: the latest live version of every group (`rows`, each with `versionCount`) and the load state */
      lists: Object.fromEntries(KINDS.map((kind) => [kind, { rows: [], loading: false, error: "", seq: 0 }])),
    };
  },
  mounted() {
    KINDS.forEach((kind) => this.loadVersioned(kind));
  },
  methods: {
    /**
     * Load the latest version of every group of one kind. Without `force` a running load is not repeated; a reload
     * after a change always runs and only the newest answer is applied. A failed reload keeps the shown rows.
     *
     * @param {"assessment"|"rubric"|"criterion"} kind
     * @param {{force?: boolean}} [options]
     */
    async loadVersioned(kind, { force = false } = {}) {
      const list = this.lists[kind];
      if (list.loading && !force) {
        return;
      }
      const seq = ++list.seq;
      list.loading = true;
      try {
        const rows = await requestAssessment(this.$socket, `${kind}GetLatest`, {});
        if (seq === list.seq) {
          list.rows = rows;
          list.error = "";
        }
      } catch (error) {
        if (seq === list.seq) {
          list.error = messageOf(error, this);
        }
      } finally {
        if (seq === list.seq) {
          list.loading = false;
        }
      }
    },
    /** Open the Versions modal of the group in this row (the latest version stands for its group). */
    openVersions(kind, row) {
      this.$refs[`${kind}VersionsModal`].open({ groupId: row[`${kind}GroupId`], name: row.name });
    },
    /** View (read-only) of one version chosen in a Versions modal. */
    viewVersion(kind, version) {
      this.$refs[`${kind}ViewModal`].openView(version.id);
    },
  },
};
