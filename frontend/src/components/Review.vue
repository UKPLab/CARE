<template>
  <Loader
    v-if="studySessionId === 0 || documentId === 0"
    :loading="true"
  />
  <span v-else>
    <Annotater/>
    <ReviewModal ref="reviewModal" />
    <ReportModal ref="reportModal" />
    <Teleport to="#topbarCustomPlaceholder">
      <button
        class="btn btn-outline-secondary me-2"
        type="button"
        @click="evaluate"
      >Evaluate</button>
      <button
        class="btn btn-outline-secondary"
        type="button"
        @click="report"
      >Report</button>
    </Teleport>
  </span>
</template>

<script>
import Loader from "@/basic/Loading.vue"
import Annotater from "@/components/annotater/Annotater.vue";
import ReviewModal from "@/components/study/ReviewModal.vue";
import ReportModal from "@/components/study/ReportModal.vue";
import {computed} from "vue";

/**
 *  Document view in reviewing mode
 *
 * Loads a document and study session in reviewing mode, i.e. readonly and with the option to assess an existing
 * study session.
 *
 * @author Dennis Zyska
 */
export default {
  name: "ReviewRoute",
  components: {ReviewModal, Loader, Annotater, ReportModal},
  provide() {
    return {
      documentId: computed(() => this.documentId),
      studySessionId: computed(() => this.studySessionId),
      readonly: this.readonly
    }
  },
  props: {
    'studySessionHash': {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      documentId: 0,
      readonly: true,
      studySessionId: 0,
    }
  },
  sockets: {
    studySessionError: function (data) {
      if (data.studySessionHash === this.studySessionHash) {
        this.eventBus.emit('toast', {
          title: "Study Session Error",
          message: data.message,
          variant: "danger"
        });
        this.$router.push("/");
      }
    }
  },
  computed: {
    studySession() {
      return this.$store.getters['table/study_session/getByHash'](this.studySessionHash);
    },
    study() {
      if (this.studySession) {
        return this.$store.getters['table/study/get'](this.studySession.studyId);
      }
      return null;
    },
  },
  watch: {
    study(newVal) {
      if (newVal) {
        this.documentId = newVal.documentId;
      } else {
        this.documentId = 0
      }
    },
    studySession(newVal) {
      if (newVal) {
        this.studySessionId = this.studySession.id;
      } else {
        this.studySessionId = 0;
      }
    }
  },
  mounted() {
    this.$socket.emit("studySessionGetByHash", {studySessionHash: this.studySessionHash});
  },
  methods: {
    evaluate() {
      this.$refs.reviewModal.open();
    },
    report() {
      this.$refs.reportModal.open();
    }
  }
}
</script>

<style scoped>
</style>