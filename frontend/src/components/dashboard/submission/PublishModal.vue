<template>
  <StepperModal
    ref="reviewStepper"
    xl
    :steps="steps"
    :validation="stepValid"
    @submit="publishReviewLinks"
  >
    <template #title>
      <h5 class="modal-title">
        {{ isSubmissionMode ? $t('dashboard.publishModal.titleSubmissions') : $t('dashboard.publishModal.titleReviews') }}
      </h5>
    </template>

    <template #step-1>
      <ReviewPublishModeStep v-model="selectedMode" />
    </template>

    <template #step-2>
      <ReviewPublishDocumentStep v-model="selectedDocuments" :is-submission-mode="isSubmissionMode" />
    </template>

    <template #step-3>
      <ReviewPublishSessionStep
        v-model="selectedSessions"
        :selected-documents="selectedDocuments"
        :is-submission-mode="isSubmissionMode"
      />
    </template>

    <template #step-4>
      <ReviewPublishLinksStep
        v-model:text-format="text_format"
        v-model:link-collection="linkCollection"
        :formatted-studies="formattedStudies"
        :formatted-sessions="formattedSessions"
      />
    </template>

    <template #step-5>
      <ReviewPublishMethodStep
        v-model:publish-method="publishMethod"
        v-model:moodle-options="moodleOptions"
        :is-submission-mode="isSubmissionMode"
        :publish-method-options="publishMethodOptions"
      />
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import { downloadObjectsAs, resolveApiMessage } from "@/assets/utils.js";
import ReviewPublishModeStep from "./ReviewPublishModeStep.vue";
import ReviewPublishDocumentStep from "./ReviewPublishDocumentStep.vue";
import ReviewPublishSessionStep from "./ReviewPublishSessionStep.vue";
import ReviewPublishLinksStep from "./ReviewPublishLinksStep.vue";
import ReviewPublishMethodStep from "./ReviewPublishMethodStep.vue";

/**
 * Modal for publish the review links to Moodle.
 * Each step is its own component; this modal keeps the selections, groups the
 * selected sessions for the links preview, and publishes or exports them.
 * @author: Dennis Zyska, Linyin Huang
 */
export default {
  name: "ReviewPublishModal",
  components: {
    StepperModal,
    ReviewPublishModeStep,
    ReviewPublishDocumentStep,
    ReviewPublishSessionStep,
    ReviewPublishLinksStep,
    ReviewPublishMethodStep,
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
    "submission",
    "study_session",
    "study_step",
    "user",
    "user_role",
    "user_role_matching",
  ],
  data() {
    return {
      selectedDocuments: [],
      selectedSessions: [],
      moodleOptions: {},
      text_format: "Reviews:\n~SESSION_LINKS~",
      publishMethod: "csv",
      linkCollection: "studies",
      selectedMode: "document",
    };
  },
  computed: {
    isSubmissionMode() {
      return this.selectedMode === "submission";
    },
    steps() {
      return [
        { title: this.$t('dashboard.publishModal.stepMode') },
        { title: this.isSubmissionMode ? this.$t('dashboard.publishModal.stepSubmissionSelection') : this.$t('dashboard.publishModal.stepDocumentSelection') },
        { title: this.$t('dashboard.publishModal.stepSessionSelection') },
        { title: this.$t('dashboard.publishModal.stepConfirmation') },
        { title: this.$t('dashboard.publishModal.stepPublishingOptions') },
      ];
    },
    stepValid() {
      return [
        true, // Step 1: Mode Selection always true
        this.selectedDocuments.length > 0, // Step 2: Documents/Submissions selected
        this.selectedSessions.length > 0, // Step 3: Sessions selected
        true, // Step 4: Confirmation always valid
        // Only require Moodle options if moodle is selected
        this.publishMethod !== "moodle" || Object.values(this.moodleOptions).every((v) => v !== ""), // Step 5: Publishing options
      ];
    },
    users() {
      return this.$store.getters["table/user/getAll"];
    },
    submissions() {
      return this.$store.getters["table/submission/getAll"];
    },
    userRoles() {
      return this.$store.getters["table/user_role/getAll"];
    },
    userRoleMatchings() {
      return this.$store.getters["table/user_role_matching/getAll"];
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
    publishMethodOptions() {
      return [
        { value: "csv", label: this.$t('dashboard.publishModal.downloadCSV'), disabled: false },
        { value: "moodle", label: "Moodle", disabled: false },
        { value: "email", label: "Email", disabled: true },
      ];
    },
  },
  watch: {
    selectedMode() {
      this.selectedDocuments = [];
      this.selectedSessions = [];
    },
  },
  methods: {
    tUserRole(roleName) {
      const key = `users.roles.${roleName}`;
      return this.$te(key) ? this.$t(key) : roleName;
    },
    getUserRoles(userId) {
      const roleMatchings = this.userRoleMatchings.filter((urm) => urm.userId === userId && !urm.deleted);
      return roleMatchings
        .map((urm) => {
          const role = this.userRoles.find((ur) => ur.id === urm.userRoleId);
          return role ? this.tUserRole(role.name) : this.$t('common.unknown');
        })
        .join(", ");
    },
    /** Opens the wizard with a fresh selection and CSV as the default publish method. */
    open() {
      this.selectedMode = "document";
      this.selectedDocuments = [];
      this.selectedSessions = [];
      this.publishMethod = "csv";
      this.$refs.reviewStepper.open();
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
          title: this.$t('dashboard.publishModal.publishReviewLinks'),
          message: this.$t('dashboard.publishModal.csvSuccessfullyGenerated'),
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
              title: this.$t('dashboard.publishModal.reviewsPublished'),
              message: this.$t('dashboard.publishModal.reviewLinksPublished'),
              variant: "success",
            });
          } else {
            this.eventBus.emit("toast", {
              title: this.$t('dashboard.publishModal.failedPublishReviews'),
              message: resolveApiMessage(res),
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
