<template>
  <span>Study Sessions</span>
</template>

<script>
/* Study.vue - dashboard component for handling studies

Author: Dennis Zyska, Nils Dycke
Source: -
*/

export default {
  name: "StudySession",
  components: {},
  data() {
    return {}
  },
  props: {},
  mounted() {
    this.load();
  },
  computed: {},
  methods: {
    load() {

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