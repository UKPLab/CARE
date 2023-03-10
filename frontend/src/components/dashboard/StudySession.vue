<template>
  <div class="container">
    <h1>Active Study Sessions</h1>
    <div v-if="!studies || studies.length === 0">
      <p class="fs-6">
        You have no active study sessions. Enter a study by clicking on the study link or create your own study.
      </p>
    </div>
    <div v-else>
      <hr>
      <div
        v-for="s in studies"
        :key="s.id"
      >
        <Card
          :title="s.name ? `Study: ${s.name}` : '<no name>'"
          collapsable
        >
          <template #body>
            <StudySessionTable :study-id="s.id" />
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
    @timeStep="trigger++"
  />
</template>

<script>
import Card from "@/basic/Card.vue";
import LoadIcon from "@/icons/LoadIcon.vue";
import StudySessionTable from "@/components/dashboard/study/StudySessionTable.vue";
import Timer from "@/basic/Timer.vue";
import {getTimeDiffString} from "@/assets/utils";

/**
 * Dashboard component for handling study sessions
 *
 * @author: Nils Dycke
 */
export default {
  name: "DashboardStudySession",
  components: {Card, LoadIcon, StudySessionTable, Timer},
  props: {},
  data() {
    return {
      trigger: 0
    }
  },
  sockets: {
    "studySessionRefresh": function (data) {
      data.forEach(s => {
        if (this.$store.getters["study/getStudyById"](s.studyId) === undefined) {
          this.$socket.emit("studyGet", {studyId: s.studyId});
        }
      });
    }
  },
  computed: {
    studies() {
      return this.$store.getters["study/getStudies"]
          .filter(s => this.sessionStudyIds.includes(s.id))
          .sort((a, b) => (new Date(a.createdAt) - new Date(b.createdAt)));
    },
    sessionStudyIds() {
      return this.$store.getters["study_session/getStudySessionsByUser"](this.$store.getters["auth/getUserId"])
          .filter(s => !s.end)
          .map(s => s.studyId);
    },
    studyTimes() {
      this.trigger; // leave here to force recompute
      return Object.fromEntries(this.studies.map(s => [s.id, s.end ? getTimeDiffString(Date.now(), new Date(s.end)) : null]));
    }
  },
  mounted() {
    this.load();
  },
  methods: {
    load() {
      // load all study sessions of the user
      this.$socket.emit("studyGetAll");
      this.$socket.emit("studySessionGetAll", {userId: this.$store.getters["auth/getUserId"]});
    },
  }
}
</script>

<style scoped>
.card .card-body {
  padding: 1rem;
}
</style>