<template>
  <div class="container">
    <h1>Active Study Sessions</h1>
    <div v-if="!studiesFiltered || studiesFiltered.length === 0">
      <p class="fs-6">
        You have no active study sessions. Enter a study by clicking on the study link or create your own study.
      </p>
    </div>
    <div v-else>
      <hr>
      <div
        v-for="s in studiesFiltered"
        :key="s.id"
      >
        <Card
          :title="s.title"
          collapsable collapsed @collapse="collapse(s.id, $event)"
        >
          <template #body>
            <StudySessionTable 
              :study-id="s.id"
              :current-user-only="true"
            />
          </template>
          <template #footer>
            <LoadIcon
              icon-name="stopwatch"
              style="margin-right:0.5rem"
            />
            <span>{{ s.end !== null ? studyTimes[s.id] : 'no due date' }}</span>
          </template>
        </Card>
        <hr>
      </div>
    </div>
  </div>

  <div class="container">
    <h1>Closed Study Sessions</h1>
    <div v-if="!studiesClosed || studiesClosed.length === 0">
      <p class="fs-6">
        You have no closed study sessions.
      </p>
    </div>
    <div v-else>
      <hr>
      <div
        v-for="s in studiesClosed"
        :key="s.id"
      >
        <Card
          :title="s.title"
          collapsable collapsed @collapse="collapse(s.id, $event)"
        >
          <template #body>
            <StudySessionTable 
              :study-id="s.id"
              :current-user-only="true"
              :show-closed="true"
            />
          </template>
        </Card>
        <hr>
      </div>
    </div>
  </div>

  <Timer
    autostart
    @time-step="trigger++"
  />
</template>

<script>
import Card from "@/components/dashboard/card/Card.vue";
import LoadIcon from "@/basic/Icon.vue";
import StudySessionTable from "@/components/dashboard/study/StudySessionTable.vue";
import Timer from "@/basic/Timer.vue";
import {getTimeDiffString} from "@/assets/utils";

/**
 * Dashboard component for handling study sessions
 *
 * @author: Nils Dycke, Dennis Zyska
 */
export default {
  name: "DashboardStudySession",
  components: {Card, LoadIcon, StudySessionTable, Timer},
  subscribeTable: [{
    table: 'study_session',
  }, "user"],
  props: {},
  data() {
    return {
      trigger: 0
    }
  },
  computed: {
    studies() {
      return this.$store.getters["table/study/getFiltered"](s => this.sessionStudyIds.includes(s.id) && s.projectId === this.$store.getters["settings/getValueAsInt"]("projects.default"))
        .sort((a, b) => (new Date(a.createdAt) - new Date(b.createdAt)))
        .map(s => {
          let study = {...s};
          const firstName = this.$store.getters["table/user/get"](study.userId)?.firstName;
            const lastName = this.$store.getters["table/user/get"](study.userId)?.lastName;
          if (this.canReadPrivateInformation && firstName && lastName) {
            study.title = study.name ? `Study: ${study.name} (from ${firstName} ${lastName})` : '<no name>';
          } else {
            study.title = study.name ? `Study: ${study.name}` : '<no name>';
          }
          return study;
        });
    },
    studiesFiltered() {
      return this.studies.filter(s => !this.isStudyClosed(s));
    },
    studiesClosed() {
      return this.studies.filter(s => this.isStudyClosed(s));
    },
    sessionStudyIds() {
      return this.$store.getters["table/study_session/getByUser"](this.$store.getters["auth/getUserId"])
        .map(s => s.studyId);
    },
    canReadPrivateInformation() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.view.userPrivateInfo");
    },
    studyTimes() {
      this.trigger; // leave here to force recompute
      return Object.fromEntries(this.studies.map(s => [s.id, s.end ? getTimeDiffString(Date.now(), new Date(s.end)) : null]));
    }
  },
  methods: {
    collapse(studyId, collapsed) {
      if (collapsed) {
        this.$socket.emit("studySessionUnsubscribe", {studyId: studyId});
      } else {
        this.$socket.emit("studySessionSubscribe", {studyId: studyId});
      }
    },
    isStudyClosed(study) {
      if (study) {
        if (study.closed) {
          return true;
        }
        if (!study.multipleSubmit && study.end && new Date(study.end) < Date.now()) {
          return true;
        }
      }
      return false;
    },
  }
}
</script>

<style scoped>
.card .card-body {
  padding: 1rem;
}
</style>