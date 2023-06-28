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
 * @author: Nils Dycke, Dennis Zyska
 */
export default {
  name: "DashboardStudySession",
  components: {Card, LoadIcon, StudySessionTable, Timer},
  fetchData: ['study_session'],
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
    sessionStudyIds() {
      return this.$store.getters["table/study_session/getByUser"](this.$store.getters["auth/getUserId"])
        .filter(s => !s.end)
        .map(s => s.studyId);
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
    }
  }
}
</script>

<style scoped>
.card .card-body {
  padding: 1rem;
}
</style>