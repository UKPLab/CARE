<template>
  <BasicCoordinator
      ref="coordinator"
      table="study"
      title="Study"
      @success="success"
  >
    <template #success>
      The study has been successfully published<br>
      Participants can join the study under the following link:<br><br>
      <a
          :href="link"
          target="_blank"
      >{{ link }}</a>
    </template>
    <template v-if="isSuccess" #buttons>
      <button
          class="btn btn-primary"
          @click="copyURL"
      >Copy Link
      </button>
    </template>
  </BasicCoordinator>
</template>

<script>
import BasicCoordinator from "@/components/dashboard/Coordinator.vue";

/**
 * StudyCoordinator - coordinator to add or edit studies
 *
 * @author Dennis Zyska
 *
 */
export default {
  name: "CoordinatorStudy",
  subscribeTable: ['document'],
  components: {BasicCoordinator},
  data() {
    return {
      studyId: 0,
      documentId: 0,
      isSuccess: false,
    }
  },
  computed: {
    study() {
      if (this.studyId !== 0) {
        return {...this.$store.getters['table/study/get'](this.studyId)};
      }
      return {};
    },
    link() {
      return window.location.origin + "/study/" + this.study.hash;
    },
  },
  methods: {
    open(studyId, documentId = null, loadInitialized = false) {
      if (documentId !== null) {
        this.documentId = documentId;
      }
      this.isSuccess = false;
      this.studyId = studyId;
      this.hash = this.studyId !== 0 ? this.study.hash : this.hash;

      if (loadInitialized) {
        this.$refs.coordinator.showSuccess();
      }
      this.$refs.coordinator.open(studyId, {documentId: this.documentId});
    },
    success(id) {
      this.studyId = id;
      this.isSuccess = true;
    },
    close() {
      this.$refs.coordinator.close();
    },
    async copyURL() {
      try {
        await navigator.clipboard.writeText(this.link);
        this.eventBus.emit('toast', {
          title: "Link copied",
          message: "Document link copied to clipboard!",
          variant: "success"
        });
      } catch ($e) {
        this.eventBus.emit('toast', {
          title: "Link not copied",
          message: "Could not copy document link to clipboard!",
          variant: "danger"
        });
      }
    }
  }
}
</script>


<style scoped>

</style>