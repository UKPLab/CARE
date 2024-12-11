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
          :title="getTitle(s)"
          collapsable collapsed @collapse="collapse(s.id, $event)"
        >
          <template #body>
            <StudySessionTable :study-id="s.id"/>
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
  <Timer
    autostart
    @time-step="trigger++"
  />
</template>

<script>
import Card from "@/basic/Card.vue";
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
    include: [
      {table: "user", by: "userId"}
    ]
  }],
  props: {},
  data() {
    return {
      trigger: 0
    }
  },
  computed: {
    studies() {
      return this.$store.getters["table/study/getFiltered"](s => this.sessionStudyIds.includes(s.id))
        .sort((a, b) => (new Date(a.createdAt) - new Date(b.createdAt)));
    },
    studiesFiltered() {
      return this.studies.filter(s => !this.isStudyClosed(s));
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
    getTitle(study) {
      if (this.canReadPrivateInformation) {
        const firstName = this.$store.getters["table/user/get"](study.userId).firstName;
        const lastName = this.$store.getters["table/user/get"](study.userId).lastName;
        return study.name ? `Study: ${study.name} (from ${firstName} ${lastName})` : '<no name>';
      } else {
        return study.name ? `Study: ${study.name}` : '<no name>';
      }
    },
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