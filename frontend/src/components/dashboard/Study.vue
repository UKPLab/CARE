<template>
  <span>Study</span>
</template>

<script>
/* Study.vue - dashboard component for handling studies

Author: Dennis Zyska, Nils Dycke
Source: -
*/

export default {
  name: "Study",
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

      this.$socket.emit("studyGet");

    },

  }
}
</script>

<style scoped>
.card .card-body {
  padding: 1rem;
}
</style>