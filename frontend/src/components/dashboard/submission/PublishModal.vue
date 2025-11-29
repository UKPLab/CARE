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
      <BasicTable
        v-model="selectedDocuments"
        :data="documentsTable"
        :columns="documentTableColumns"
        :options="tableOptions"
        :max-table-height="400"
      />
    </template>
    <template #step-2>
      <BasicTable
        v-model="selectedSessions"
        :data="sessionsTable"
        :columns="sessionTableColumns"
        :options="tableOptions"
        :max-table-height="400"
      />
    </template>
    <template #step-3>
      <div class="mb-3">
        <label
          for="text_format"
          class="form-label"
          ><b>Text Format:</b></label
        >
        <textarea
          v-model="text_format"
          class="form-control"
          id="text_format"
          rows="3"
        ></textarea>
        <div class="small">
          <p>
            <span>The placeholder <code>~SESSION_LINKS~</code> will be replaced with the review links.<br /></span>
            <span v-if="linkCollection === 'studies'">
              The placeholder <code>~USERNAME~</code> will be replaced with the CARE username of the document owner.
            </span>
          </p>
        </div>
      </div>
      <div class="mb-3">
        <label
          for="publishMethod"
          class="form-label"
          ><b>Link Collection:</b></label
        >
        <select
          v-model="linkCollection"
          class="form-select"
          id="publishMethod"
        >
          <option value="studies">based on Studies (session links for each study)</option>
          <option value="sessions">based on Sessions (links for own sessions)</option>
        </select>
      </div>
      <div class="mb-3">
        <p><b>Links:</b></p>
        <ul v-if="linkCollection === 'studies'">
          <li
            v-for="doc in formattedStudies"
            :key="doc"
          >
            <b>{{ doc.document.name }} ({{ doc.document.firstName }} {{ doc.document.lastName }})</b>
            <ul>
              <li
                v-for="session in doc.sessions"
                :key="session"
              >
                {{ session.firstName }} {{ session.lastName }} (<a
                  :href="session.link"
                  target="_blank"
                  >{{ session.link }}</a
                >)
              </li>
            </ul>
          </li>
        </ul>
        <ul v-else-if="linkCollection === 'sessions'">
          <li
            v-for="session in formattedSessions"
            :key="session"
          >
            <b>{{ session[0].firstName }} {{ session[0].lastName }}</b>
            <ul>
              <li
                v-for="s in session"
                :key="s"
              >
                {{ s.document.documentName }} (<a
                  :href="s.link"
                  target="_blank"
                  >{{ s.link }}</a
                >)
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </template>
    <template #step-4>
      <div class="mb-3">
        <label
          for="publishMethod"
          class="form-label"
          ><b>Publishing Method:</b></label
        >
        <select
          v-model="publishMethod"
          class="form-select"
          id="publishMethod"
        >
          <option
            v-for="opt in publishMethodOptions"
            :key="opt.value"
            :value="opt.value"
            :disabled="opt.disabled"
          >
            {{ opt.label }}
          </option>
        </select>
      </div>
      <div
        class="small"
        v-if="isSubmissionMode"
      >
        <p>Choose "Download CSV" to export the generated feedback text for each recipient.</p>
      </div>
      <div v-if="publishMethod === 'moodle'">
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
import { downloadObjectsAs } from "@/assets/utils.js";

/**
 * Modal for publish the review links to Moodle
 * @author: Dennis Zyska, Linyin Huang
 */
export default {
  name: "ReviewPublishModal",
  components: { MoodleOptions, BasicTable, StepperModal },
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
    },
    {
      table: "user_role",
    },
    {
      table: "user_role_matching",
    },
  ],
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
      publishMethod: "csv",
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
        { title: this.isSubmissionMode ? "Submission Selection" : "Document Selection" },
        { title: "Session Selection" },
        { title: "Confirmation" },
        { title: "Publishing Options" },
      ];
    },
    stepValid() {
      return [
        this.selectedDocuments.length > 0,
        this.selectedSessions.length > 0,
        // Only require Moodle options if moodle is selected
        this.publishMethod !== "moodle" || Object.values(this.moodleOptions).every((v) => v !== ""),
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
    userRoles() {
      return this.$store.getters["table/user_role/getAll"];
    },
    userRoleMatchings() {
      return this.$store.getters["table/user_role_matching/getAll"];
    },
    documentsTable() {
      if (!this.isSubmissionMode) {
        return this.documents
          .map((document) => {
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
            };
          })
          .filter((s) => s !== null);
      }

      // submission mode: aggregate sessions across documents belonging to the submission
      return this.submissions
        .map((submission) => {
          const docs = this.$store.getters["table/document/getFiltered"]((d) => d.submissionId === submission.id);

          // per document, collect closed studyIds
          const docSummaries = docs.map((doc) => {
            const steps = this.studySteps.filter((step) => step.documentId === doc.id);
            const closedStudyIds = [...new Set(steps.map((s) => s.studyId))].filter((id) => this.studies.find((st) => st.id === id));
            return {
              id: doc.id,
              name: doc.name,
              documentName: doc.name.length <= 40 ? doc.name : doc.name.substring(0, 40) + "...",
              submissionId: doc.submissionId,
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
        })
        .filter((s) => s !== null);
    },
    sessionsTable() {
      return this.selectedDocuments.flatMap((d) =>
        d.sessionIds.map((sId) => {
          const session = this.studySessions.find((s) => sId === s.id);
          const study = this.studies.find((s) => s.id === session.studyId);
          const user = this.users.find((u) => u.id === session.userId);

          // resolve document per session in submission mode
          let docRef = null;
          if (this.isSubmissionMode && d.documents) {
            const found = d.documents.find((doc) => doc.studyIds.includes(session.studyId)) || null;
            docRef = found
              ? {
                  ...found,
                  // carry owner info from submission-level row
                  extId: d.extId,
                  firstName: d.firstName,
                  lastName: d.lastName,
                }
              : null;
          } else {
            docRef = d;
          }

          return {
            studyName: study.name,
            firstName: user ? user.firstName : "unknown",
            lastName: user ? user.lastName : "unknown",
            userId: session.userId,
            studyId: session.studyId,
            sessionId: session.id,
            link: window.location.origin + "/review/" + session.hash,
            documentName: docRef ? docRef.documentName || docRef.name || "-" : "-",
            document: docRef,
            extId: user ? user.extId : "",
            start: session.start,
            end: session.end,
            hash: session.hash,
          };
        })
      );
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
      return this.selectedDocuments
        .filter((d) => {
          return this.selectedSessions.find((s) => s.document.id === d.id);
        })
        .map((d) => {
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
          { name: "extId", key: "extId" },
          { name: "First Name", key: "firstName" },
          { name: "Last Name", key: "lastName" },
          { name: "Document Title", key: "documentName" },
          { name: "Studies", key: "studies" },
          { name: "Sessions", key: "sessions" },
        ];
      }
      return [
        { name: "extId", key: "extId" },
        { name: "Submission ID", key: "submissionId" },
        { name: "Group", key: "group" },
        { name: "First Name", key: "firstName" },
        { name: "Last Name", key: "lastName" },
        { name: "Studies", key: "studies" },
        { name: "Sessions", key: "sessions" },
      ];
    },
    sessionTableColumns() {
      return [
        { name: "Study Name", key: "studyName" },
        { name: "First Name", key: "firstName" },
        { name: "Last Name", key: "lastName" },
        { name: "Document Title", key: "documentName" },
      ];
    },
    publishMethodOptions() {
      return [
        { value: "csv", label: "Download CSV", disabled: false },
        { value: "moodle", label: "Moodle", disabled: this.isSubmissionMode },
        { value: "email", label: "Email", disabled: true },
      ];
    },
  },
  methods: {
    getUserRoles(userId) {
      const roleMatchings = this.userRoleMatchings.filter((urm) => urm.userId === userId && !urm.deleted);
      return roleMatchings
        .map((urm) => {
          const role = this.userRoles.find((ur) => ur.id === urm.userRoleId);
          return role ? role.name : "Unknown";
        })
        .join(", ");
    },
    open() {
      this.reset();
      // set default publish method per mode
      this.publishMethod = "csv";
      this.$refs.reviewStepper.open();
    },
    reset() {
      this.selectedDocuments = [];
      this.selectedSessions = [];
    },
    publishReviewLinks() {
      const feedback =
        this.linkCollection === "studies"
          ? this.formattedStudies.map((doc) => {
              let text = this.text_format;
              const username = doc.document.creator_name || [doc.document.firstName, doc.document.lastName].filter(Boolean).join(" ");
              text = text.replace("~USERNAME~", username);
              return {
                extId: doc.document.extId,
                text: text.replace("~SESSION_LINKS~", doc.sessions.map((s) => s.link).join("\n")),
              };
            })
          : Object.keys(this.formattedSessions).map((userId) => {
              return {
                extId: this.formattedSessions[userId][0].extId,
                text: this.text_format.replace("~SESSION_LINKS~", this.formattedSessions[userId].map((s) => s.link).join("\n")),
              };
            });
      if (this.publishMethod === "csv") {
        this.downloadCSV();
        this.$refs.reviewStepper.close();
        this.eventBus.emit("toast", {
          title: "Publish study session links",
          message: "CSV successfully generated and exported",
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
    downloadCSV() {
      const buildRow = (docObj, user, userRoles, submission, session, reviewer, reviewerRoles) => ({
        "User ExtId": docObj.extId || "",
        "User First Name": docObj.firstName || "",
        "User Last Name": docObj.lastName || "",
        "User Name": user ? user.userName : "",
        "Submission ID": docObj.submissionId || "",
        "Submission ExtId": submission ? submission.extId : "",
        "User Roles": userRoles,
        "Reviewer First Name": session.firstName || "",
        "Reviewer Last Name": session.lastName || "",
        "Reviewer User Name": reviewer ? reviewer.userName : "",
        "Reviewer Roles": reviewerRoles,
        Links: session.link || "",
        Text: this.text_format
          .replace("~SESSION_LINKS~", session.link)
          .replace("~USERNAME~", ((docObj.firstName || "") + " " + (docObj.lastName || "")).trim()),
      });

      const rows = [];

      if (this.linkCollection === "studies") {
        this.formattedStudies.forEach((doc) => {
          const ownerDoc = doc.document;
          const user = this.users.find((u) => u.id === ownerDoc.userId || u.extId === ownerDoc.extId);
          const userRoles = user ? this.getUserRoles(user.id) : "";
          const submission = this.submissions.find((s) => s.id === ownerDoc.submissionId);

          doc.sessions.forEach((session) => {
            const reviewer = this.users.find((u) => u.id === session.userId);
            const reviewerRoles = reviewer ? this.getUserRoles(reviewer.id) : "";
            rows.push(buildRow(ownerDoc, user, userRoles, submission, session, reviewer, reviewerRoles));
          });
        });
      } else {
        Object.keys(this.formattedSessions).forEach((userId) => {
          const sessions = this.formattedSessions[userId];
          const reviewer = this.users.find((u) => u.id === parseInt(userId));
          const reviewerRoles = reviewer ? this.getUserRoles(reviewer.id) : "";

          sessions.forEach((session) => {
            const ownerDoc = session.document;
            const user = this.users.find((u) => u.id === ownerDoc.userId || u.extId === ownerDoc.extId);
            const userRoles = user ? this.getUserRoles(user.id) : "";
            const submission = this.submissions.find((s) => s.id === ownerDoc.submissionId);
            rows.push(buildRow(ownerDoc, user, userRoles, submission, session, reviewer, reviewerRoles));
          });
        });
      }

      const fileBaseName = `feedback_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`;
      downloadObjectsAs(rows, fileBaseName, "csv");
    },
  },
};
</script>

<style scoped></style>
