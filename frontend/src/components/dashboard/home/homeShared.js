import { formatLocalizedDateTime, getTimeDiffString } from "@/assets/utils";
import { DAY_MS, SOON_MS } from "@/components/dashboard/study/studyCardHelpers.js";

/**
 * Helpers shared by more than one Home panel. Keep them here so a
 * deadline or session rule is not copied into each panel.
 */
export const homeShared = {
  methods: {
    /**
     * Icon and label per document type: 0 PDF (annotator),
     * 1 text (editor), 2 configuration (editor with configurator).
     * @param {{ type: number }} doc
     * @returns {{ kind: string, icon: string, label: string }}
     */
    documentKind(doc) {
      if (doc.type === 1) {
        return { kind: "text", icon: "file-earmark-text", label: this.$t("dashboard.home.kindText") };
      }
      if (doc.type === 2) {
        return { kind: "text", icon: "file-earmark-code", label: this.$t("dashboard.home.kindConfig") };
      }
      return { kind: "pdf", icon: "file-earmark-pdf", label: this.$t("dashboard.home.kindPdf") };
    },
    /**
     * @param {object} session
     * @returns {{ key: string, title: string, detail: string, to: string }}
     */
    sessionLink(session) {
      const study = this.$store.getters["table/study/get"](session.studyId);
      const when = getTimeDiffString(Date.now(), new Date(session.start || session.createdAt));
      return {
        key: `session-${session.id}`,
        title: study?.name || this.$t("sidebar.nav.my_sessions"),
        detail: this.$t("dashboard.home.started", { when }),
        to: `/session/${session.hash}`,
      };
    },
    /**
     * @param {number} remainingMs
     * @returns {"overdue"|"urgent"|"soon"|"later"}
     */
    dueTone(remainingMs) {
      if (remainingMs < 0) return "overdue";
      if (remainingMs < DAY_MS) return "urgent";
      if (remainingMs < SOON_MS) return "soon";
      return "later";
    },
    /**
     * @param {{ at: number, kind: string }|null} deadline
     * @returns {{ tone: string, label: string, title: string }}
     */
    dueBadge(deadline) {
      if (!deadline) {
        return { tone: "none", label: this.$t("dashboard.home.noDeadline"), title: "" };
      }
      const remaining = deadline.at - this.now;
      const when = getTimeDiffString(this.now, deadline.at);
      const date = formatLocalizedDateTime(new Date(deadline.at));
      return {
        tone: this.dueTone(remaining),
        label: remaining < 0
          ? this.$t("dashboard.home.overdue", { when })
          : this.$t("dashboard.home.dueIn", { when }),
        title: deadline.kind === "timeLimit"
          ? this.$t("dashboard.home.deadlineTimeLimit", { date })
          : this.$t("dashboard.home.deadlineStudy", { date }),
      };
    },
  },
};
