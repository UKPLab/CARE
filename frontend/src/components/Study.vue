<template>
  <div class="container-fluid d-flex min-vh-100 vh-100 flex-column">
    <Loader v-if="!study" :loading="true" class="pageLoader"></Loader>
    <div v-else>

           <span>
         Study: {{ study }}

       </span>
    </div>

  </div>
</template>

<script>
import Loader from "@/basic/Loader.vue";

export default {
  name: "Study",
  components: {Loader},
  data() {
    return {
      loading: true
    }
  },
  props: {
    'studyHash': {
      type: String,
      required: true,
    },
  },
  mounted() {
    this.load();
  },
  computed: {
    study() {
      return this.$store.getters['study/getStudyByHash'](this.studyHash);
    }
  },
  methods: {
    load() {
      console.log("loading");
      this.$socket.emit("studyGetByHash", {studyHash: this.studyHash});
    },
  }
}
</script>

<style scoped>
.pageLoader {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%)
}
</style>