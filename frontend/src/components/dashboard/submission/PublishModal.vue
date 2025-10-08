<template>
  <StepperModal
    ref="reviewStepper"
    xl
    :steps="steps"
    :validation="stepValid"
    @submit="publishReviewLinks"
  >
    <template #title>
      <h5 class="modal-title">{{ modalTitle }}</h5>
    </template>
    <template #step-1>
      <div class="table-scroll-container">
        <BasicTable
          v-model="selectedDocuments"
          :data="documentsTable"
          :columns="documentTableColumns"
          :options="tableOptions"
        />
      </div>
    </template>
    <template #step-2>
      <div class="table-scroll-container">
        <BasicTable
          v-model="selectedSessions"
          :data="sessionsTable"
          :columns="sessionTableColumns"
          :options="tableOptions"
        />
      </div>
    </template>
    <template #step-3>
      <div class="mb-3">
        <label for="text_format" class="form-label"><b>Text Format:</b></label>
        <textarea v-model="text_format" class="form-control" id="text_format" rows="3"></textarea>
        <div class="small">
          <p>
            <span>The placeholder <code>~SESSION_LINKS~</code> will be replaced with the review links.<br></span>
            <span v-if="linkCollection === 'studies'">
              The placeholder <code>~USERNAME~</code> will be replaced with the CARE username of the document owner.
            </span>
          </p>
        </div>
      </div>
      <div class="mb-3">
        <label for="publishMethod" class="form-label"><b>Link Collection:</b></label>
        <select v-model="linkCollection" class="form-select" id="publishMethod">
          <option value="studies">based on Studies (session links for each study)</option>
          <option value="sessions">based on Sessions (links for own sessions)</option>
        </select>
      </div>
      <div class="mb-3" v-if="!isSubmissionMode">
        <label for="publishMethod" class="form-label"><b>Publishing Method:</b></label>
        <select v-model="publishMethod" class="form-select" id="publishMethod">
          <option value="moodle">Moodle</option>
          <option value="email" disabled>Email</option>
        </select>
      </div>
      <div class="mb-3 table-scroll-container">
        <p><b>Links:</b></p>
        <ul v-if="linkCollection === 'studies'">
          <li v-for="doc in formattedStudies" :key="doc">
            <b>{{ doc.document.name }} ({{ doc.document.firstName }} {{ doc.document.lastName }})</b>
            <ul>
              <li v-for="session in doc.sessions" :key="session">
                {{ session.firstName }} {{ session.lastName }} (<a :href="session.link"
                                                                   target="_blank">{{ session.link }}</a>)
              </li>
            </ul>
          </li>
        </ul>
        <ul v-else-if="linkCollection === 'sessions'">
          <li v-for="session in formattedSessions" :key="session">
            <b>{{ session[0].firstName }} {{ session[0].lastName }}</b>
            <ul>
              <li v-for="s in session" :key="s">
                {{ s.document.documentName }} (<a :href="s.link" target="_blank">{{ s.link }}</a>)
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </template>
    <template #step-4>
      <div v-if="isSubmissionMode" class="table-scroll-container">
        <div class="mb-3">
          <label for="submissionPublishMethod" class="form-label"><b>Publishing Options:</b></label>
          <select v-model="publishMethod" class="form-select" id="submissionPublishMethod">
            <option value="csv">Download CSV</option>
            <option value="moodle" disabled>Publish Moodle (disabled)</option>
            <option value="email" disabled>Send via Email (disabled)</option>
          </select>
        </div>
        <div class="small">
          <p>Choose "Download CSV" to export the generated feedback text for each recipient.</p>
        </div>
      </div>
      <div v-else-if="publishMethod==='moodle'" class="table-scroll-container">
        <MoodleOptions
          ref="moodleOptionsForm"
          v-model="moodleOptions"
          with-assignment-id
        />
      </div>
    </template>
  </StepperModal>
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import MoodleOptions from "@/basic/form/MoodleOptions.vue";
import StepperModal from "@/basic/modal/StepperModal.vue";

/**
 * Modal for publish the review links to Moodle
 * @author: Dennis Zyska, Linyin Huang
 */
export default {
  name: "ReviewPublishModal",
  props: {
    // mode: 'reviews' (document-based) or 'submission' (submission-based)
    mode: {
      type: String,
      default: "reviews",
      validator: (v) => ["reviews", "submission"].includes(v),
    },
  },
  subscribeTable: [
    {
      table: "document",
      filter: [
        {
          key: "readyForReview",
          value: true,
        },
      ],
    },
    {
      table: "submission",
    },
    {
      table: "study_session",
    },
    {
      table: "study_step",
    },
    {
      table: "user",
    }
  ],
  components: {MoodleOptions, BasicTable, StepperModal},
  data() {
    return {
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        pagination: false,
      },
      selectedDocuments: [],
      selectedSessions: [],
      moodleOptions: {},
      text_format: "Reviews:\n~SESSION_LINKS~",
      publishMethod: this.mode === "submission" ? "csv" : "moodle",
      linkCollection: "studies",
    };
  },
  computed: {
    isSubmissionMode() {
      return this.mode === "submission";
    },
    modalTitle() {
      return this.isSubmissionMode ? "Publish Submissions" : "Publish Reviews";
    },
    steps() {
      return [
        {title: this.isSubmissionMode ? "Submission Selection" : "Document Selection"},
        {title: "Session Selection"},
        {title: "Confirmation"},
        {title: "Publishing Options"},
      ];
    },
    stepValid() {
      return [
        this.selectedDocuments.length > 0,
        this.selectedSessions.length > 0,
        // Only require Moodle options if moodle is selected
        this.publishMethod !== "moodle" || Object.values(this.moodleOptions).every(v => v !== ""),
      ];
    },
    usersWithExtId() {
      return this.$store.getters["table/user/getFiltered"]((u) => u.extId !== null);
    },
    users() {
      return this.$store.getters["table/user/getAll"];
    },
    studies() {
      return this.$store.getters["table/study/getFiltered"]((s) => s.closed);
    },
    documents() {
      return this.$store.getters["table/document/getFiltered"]((d) => d.readyForReview);
    },
    submissions() {
      return this.$store.getters["table/submission/getAll"];
    },
    studySteps() {
      return this.$store.getters["table/study_step/getAll"];
    },
    studySessions() {
      return this.$store.getters["table/study_session/getAll"];
    },
    documentsTable() {
      if (!this.isSubmissionMode) {
        return this.documents.map((document) => {
          // find all study steps that are associated with this document
          const studySteps = this.studySteps.filter((step) => step.documentId === document.id);
          // get unique study ids from the study steps
          const studyIds = [...new Set(studySteps.map((step) => step.studyId))].filter((id) => this.studies.find((s) => s.id === id));

          if (studyIds.length === 0) {
            return null;
          }

          // get sessions for each study
          const studySessionIds = this.studySessions.filter((session) => studyIds.includes(session.studyId)).map((session) => session.id);
          if (studySessionIds.length === 0) {
            return null;
          }

          const user = this.usersWithExtId.find((u) => u.id === document.userId);
          if (!user) {
            return null;
          }

          return {
            ...document,
            studyIds,
            documentName: document.name.length <= 40 ? document.name : document.name.substring(0, 40) + "...",
            sessionIds: studySessionIds,
            studies: studyIds.length,
            sessions: studySessionIds.length,
            extId: user.extId,
            firstName: user.firstName,
            lastName: user.lastName,
          }

        }).filter((s) => s !== null);
      }

      // submission mode: aggregate sessions across documents belonging to the submission
      return this.submissions.map((submission) => {
        const docs = this.$store.getters["table/document/getFiltered"]((d) => d.submissionId === submission.id);

        // per document, collect closed studyIds
        const docSummaries = docs.map((doc) => {
          const steps = this.studySteps.filter((step) => step.documentId === doc.id);
          const closedStudyIds = [...new Set(steps.map((s) => s.studyId))].filter((id) => this.studies.find((st) => st.id === id));
          return {
            id: doc.id,
            name: doc.name,
            documentName: doc.name.length <= 40 ? doc.name : doc.name.substring(0, 40) + "...",
            studyIds: closedStudyIds,
          };
        });

        const uniqueStudyIds = [...new Set(docSummaries.flatMap((d) => d.studyIds))];
        if (uniqueStudyIds.length === 0) {
          return null;
        }
        const studySessionIds = this.studySessions.filter((session) => uniqueStudyIds.includes(session.studyId)).map((session) => session.id);
        if (studySessionIds.length === 0) {
          return null;
        }

        const user = this.usersWithExtId.find((u) => u.id === submission.userId);
        if (!user) {
          return null;
        }

        return {
          id: submission.id,
          submissionId: submission.extId,
          documents: docSummaries,
          studyIds: uniqueStudyIds,
          sessionIds: studySessionIds,
          studies: uniqueStudyIds.length,
          sessions: studySessionIds.length,
          extId: user.extId,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      }).filter((s) => s !== null);
    },
    sessionsTable() {
      return this.selectedDocuments.flatMap(d => d.sessionIds.map(sId => {
        const session = this.studySessions.find((s) => sId === s.id);
        const study = this.studies.find((s) => s.id === session.studyId);
        const user = this.users.find((u) => u.id === session.userId);

        // resolve document per session in submission mode
        let docRef = null;
        if (this.isSubmissionMode && d.documents) {
          const found = d.documents.find((doc) => doc.studyIds.includes(session.studyId)) || null;
          docRef = found ? {
            ...found,
            // carry owner info from submission-level row
            extId: d.extId,
            firstName: d.firstName,
            lastName: d.lastName,
          } : null;
        } else {
          docRef = d;
        }

        return {
          studyName: study.name,
          firstName: (user) ? user.firstName : "unknown",
          lastName: (user) ? user.lastName : "unknown",
          userId: session.userId,
          studyId: session.studyId,
          sessionId: session.id,
          link: window.location.origin + "/review/" + session.hash,
          documentName: docRef ? (docRef.documentName || docRef.name || "-") : "-",
          document: docRef,
          extId: (user) ? user.extId: "",
          start: session.start,
          end: session.end,
          hash: session.hash,
        }
      }));
    },
    formattedStudies() {
      if (this.isSubmissionMode) {
        // group by actual document from sessions
        const docMap = {};
        this.selectedSessions.forEach((s) => {
          if (s.document && s.document.id) {
            docMap[s.document.id] = s.document;
          }
        });
        return Object.values(docMap).map((doc) => ({
          document: doc,
          sessions: this.selectedSessions.filter((s) => s.document && s.document.id === doc.id),
        }));
      }
      return this.selectedDocuments.filter((d) => {
        return this.selectedSessions.find((s) => s.document.id === d.id);
      }).map((d) => {
        return {
          document: d,
          sessions: this.selectedSessions.filter((s) => s.document.id === d.id),
        };
      });
    },
    formattedSessions() {
      // group by userId
      return this.selectedSessions.reduce((acc, session) => {
        const key = session.userId;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(session);
        return acc;
      }, {});
    },
    documentTableColumns() {
      if (!this.isSubmissionMode) {
        return [
          {name: "extId", key: "extId"},
          {name: "First Name", key: "firstName"},
          {name: "Last Name", key: "lastName"},
          {name: "Document Title", key: "documentName"},
          {name: "Studies", key: "studies"},
          {name: "Sessions", key: "sessions"},
        ];
      }
      return [
        {name: "Submission ID", key: "submissionId"},
        {name: "First Name", key: "firstName"},
        {name: "Last Name", key: "lastName"},
        {name: "Studies", key: "studies"},
        {name: "Sessions", key: "sessions"},
      ];
    },
    sessionTableColumns() {
      return [
        {name: "Study Name", key: "studyName"},
        {name: "First Name", key: "firstName"},
        {name: "Last Name", key: "lastName"},
        {name: "Document Title", key: "documentName"},
      ];
    },
  },
  methods: {
    open() {
      this.reset();
      // set default publish method per mode
      this.publishMethod = this.isSubmissionMode ? "csv" : "moodle";
      this.$refs.reviewStepper.open();
    },
    reset() {
      this.selectedDocuments = [];
      this.selectedSessions = [];
    },
    publishReviewLinks() {
      const feedback = (this.linkCollection === 'studies') ? this.formattedStudies.map((doc) => {
        let text = this.text_format;
        const username = doc.document.creator_name || [doc.document.firstName, doc.document.lastName].filter(Boolean).join(" ");
        text = text.replace("~USERNAME~", username);
        return {
          extId: doc.document.extId,
          text: text.replace("~SESSION_LINKS~", doc.sessions.map((s) => s.link).join("\n")),
        };
      }) : Object.keys(this.formattedSessions).map((userId) => {
        return {
          extId: this.formattedSessions[userId][0].extId,
          text: this.text_format.replace("~SESSION_LINKS~", this.formattedSessions[userId].map((s) => s.link).join("\n")),
        };
      });
      if (this.isSubmissionMode && this.publishMethod === 'csv') {
        this.downloadCSV(feedback);
        this.$refs.reviewStepper.close();
        this.eventBus.emit("toast", {
          title: "CSV ready",
          message: "Feedback exported as CSV.",
          variant: "success",
        });
        return;
      }

      this.$refs.reviewStepper.setWaiting(true);
      this.$socket.emit(
        "documentPublishReviewLinks",
        {
          options: this.moodleOptions,
          feedback: feedback,
        },
        (res) => {
          this.$refs.reviewStepper.setWaiting(false);
          if (res.success) {
            this.$refs.reviewStepper.close();
            this.eventBus.emit("toast", {
              title: "Reviews published",
              message: "The review links have been successfully published!",
              variant: "success",
            });
          } else {
            this.eventBus.emit("toast", {
              title: "Failed to publish reviews",
              message: res.message,
              variant: "danger",
            });
          }
        }
      );
    },
    downloadCSV(rows) {
      const escapeCsv = (value) => {
        if (value == null) return "";
        const str = String(value).replace(/"/g, '""');
        if (str.search(/[",\n]/g) >= 0) {
          return '"' + str + '"';
        }
        return str;
      };
      const header = ["extId", "text"];
      const csv = [header.join(",")]
        .concat(rows.map((r) => [escapeCsv(r.extId), escapeCsv(r.text)].join(",")))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `feedback_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  },
};
</script>

<style scoped>
.table-scroll-container {
  max-height: 400px;
  min-height: 80px;
  overflow-y: auto;
}
</style>
