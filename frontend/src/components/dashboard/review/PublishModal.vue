<template>
  <StepperModal
    ref="reviewStepper"
    xl
    :steps="steps"
    :validation="stepValid"
    @submit="publishReviewLinks"
  >
    <template #title>
      <h5 class="modal-title">Publish Reviews</h5>
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
            The placeholder <code>~SESSION_LINKS~</code> will be replaced with the review links.<br>
            The placeholder <code>~USERNAME~</code> will be replaced with the CARE username of the document owner.
          </p>
        </div>
      </div>
      <div class="mb-3">
        <label for="publishMethod" class="form-label"><b>Publishing Method:</b></label>
        <select v-model="publishMethod" class="form-select" id="publishMethod">
          <option value="moodle">Moodle</option>
          <option value="email" disabled>Email</option>
        </select>
      </div>
      <div class="mb-3 table-scroll-container">
        <p><b>Selected documents:</b></p>
        <ul>
          <li v-for="doc in formattedSessions" :key="doc">
            <b>{{ doc.document.name }} ({{ doc.document.firstName }} {{ doc.document.lastName }})</b>
            <ul>
              <li v-for="session in doc.sessions" :key="session">
                {{ session.firstName }} {{ session.lastName }} (<a :href="session.link"
                                                                   target="_blank">{{ session.link }}</a>)
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </template>
    <template #step-4>
      <div v-if="publishMethod==='moodle'" class="table-scroll-container">
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
import MoodleOptions from "@/plugins/moodle/MoodleOptions.vue";
import StepperModal from "@/basic/modal/StepperModal.vue";

/**
 * Modal for publish the review links to Moodle
 * @author: Linyin Huang, Dennis Zyska
 */
export default {
  name: "ReviewPublishModal",
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
      publishMethod: "moodle",
    };
  },
  computed: {
    steps() {
      return [
        {title: "Document Selection"},
        {title: "Session Selection"},
        {title: "Confirmation"},
        {title: "Publishing Options"},
      ];
    },
    stepValid() {
      return [
        Object.values(this.moodleOptions).every(v => v !== ""),
        this.selectedDocuments.length > 0,
        this.selectedSessions.length > 0,
        true,
      ];
    },
    users() {
      return this.$store.getters["table/user/getFiltered"]((u) => u.extId !== null);
    },
    studies() {
      return this.$store.getters["table/study/getFiltered"]((s) => s.closed);
    },
    documents() {
      return this.$store.getters["table/document/getFiltered"]((d) => d.readyForReview);
    },
    studySteps() {
      return this.$store.getters["table/study_step/getAll"];
    },
    studySessions() {
      return this.$store.getters["table/study_session/getAll"];
    },
    documentsTable() {
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

        const user = this.users.find((u) => u.id === document.userId);
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
    },
    sessionsTable() {
      return this.selectedDocuments.flatMap(d => d.sessionIds.map(sId => {
        const session = this.studySessions.find((s) => sId === s.id);
        const study = this.studies.find((s) => s.id === session.studyId);
        const user = this.users.find((u) => u.id === session.userId);

        return {
          studyName: study.name,
          firstName: (user) ? user.firstName : "unknown",
          lastName: (user) ? user.lastName : "unknown",

          studyId: session.studyId,
          sessionId: session.id,
          link: window.location.origin + "/review/" + session.hash,
          documentName: d.documentName,
          document: d,
          start: session.start,
          end: session.end,
          hash: session.hash,
        }
      }));
    },
    formattedSessions() {
      return this.selectedDocuments.filter((d) => {
        return this.selectedSessions.find((s) => s.document.id === d.id);
      }).map((d) => {
        return {
          document: d,
          sessions: this.selectedSessions.filter((s) => s.document.id === d.id),
        };
      });
    },
    documentTableColumns() {
      return [
        {name: "extId", key: "extId"},
        {name: "First Name", key: "firstName"},
        {name: "Last Name", key: "lastName"},
        {name: "Document Title", key: "documentName"},
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
      this.$refs.reviewStepper.open();
    },
    reset() {
      this.selectedDocuments = [];
      this.selectedSessions = [];
    },
    publishReviewLinks() {
      const feedback = this.formattedSessions.map((doc) => {
        let text = this.text_format;
        text = text.replace("~USERNAME~", doc.document.userName);
        return {
          extId: doc.document.extId,
          text: text.replace("~SESSION_LINKS~", doc.sessions.map((s) => s.link).join("\n")),
        };
      });

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
