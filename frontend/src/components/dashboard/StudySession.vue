<template>
  <div class="container">
    <h2>Active Study Sessions</h2>
    <hr>
    <div class="row">
      <div v-for="s in studies" :key="s.id" class="col-6 col-sm-3 col-md-4 col-lg-6">
        <Card :title="s.name ? `Study: ${s.name}` : '<no name>'">
          <template v-slot:body>
            <StudySessionTable :study-id="s.id"></StudySessionTable>
          </template>
          <template v-slot:footer>
            <span class="fw-light fs-6"> meta data </span>
          </template>
        </Card>
        <hr>
      </div>
    </div>
  </div>
  <hr>
</template>

<script>
/* StudySession.vue - dashboard component for handling study sessions

Author: Nils Dycke, Dennis Zyska
Source: -
*/

import Card from "@/basic/Card.vue";
import Table from "@/basic/table/Table.vue";
import LoadIcon from "@/icons/LoadIcon.vue";
import StudyModal from "@/components/dashboard/study/StudyModal.vue";
import StudySessionTable from "@/components/dashboard/study/StudySessionTable.vue";
import {getTimeDiffString} from "@/assets/utils";

export default {
  name: "StudySession",
  components: {Card, Table, LoadIcon, StudyModal, StudySessionTable},
  data() {
    return {}
  },
  props: {},
  sockets: {
    "studySessionRefresh": function (data) {
      data.forEach(s => {
        if (this.$store.getters["study/getStudyById"](s.studyId) === undefined) {
          this.$socket.emit("studyGetById", {studyId: s.studyId});
        }
      });
    }
  },
  mounted() {
    this.load();
  },
  computed: {
    studies() {
      return this.$store.getters["study/getStudies"].filter(s => this.sessions.includes(s.id));
    },
    sessions() {
      return this.$store.getters["study_session/getStudySessionsByUser"](this.$store.getters["auth/getUserId"]).map(s => s.studyId);
    }
  },
  methods: {
    load() {
      // load all study sessions of the user
      this.$socket.emit("studySessionGet");
    },
  }
}
</script>

<style scoped>
.card .card-body {
  padding: 1rem;
}
</style>