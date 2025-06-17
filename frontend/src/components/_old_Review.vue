<template>
  <Loader
    v-if="studySessionId === 0 || documentId === 0"
    :loading="true"
    />
  <span v-else>
    <Annotator
     v-if="documentType === 0"
     />
    <Editor
     v-if="documentType === 1"
     :readonly="readonly"
     />
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
import Loader from "@/basic/Loading.vue";
import Annotator from "@/components/annotator/Annotator.vue";
import ReviewModal from "@/components/study/ReviewModal.vue";
import ReportModal from "@/components/study/ReportModal.vue";
import { computed } from "vue";
import Editor from "./editor/editor/Editor.vue";

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
  components: { ReviewModal, Loader, Annotator, ReportModal, Editor },
  provide() {
    return {
      documentId: computed(() => this.documentId),
      studySessionId: computed(() => this.studySessionId),
      readonly: this.readonly,
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
      documentType: null,
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
    },
    studyRefresh(data) {
      //HARD CODED FOR NOW
      const documentId = data[0]["studySteps"][0]["documentId"];
      this.$store.getters['table/study_session/get'](this.studySessionId)
      const documentType = this.$store.getters['table/document/get'](documentId)["type"];
      this.documentId = documentId;
      this.documentType = documentType;
    }
  },
  computed: {
    document() {
      return this.$store.getters['table/document/getByHash'](this.documentHash);
    },
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
        //HARD CODED FOR NOW
        const documentId = newVal["studySteps"][0]["documentId"];;
        const documentType = this.$store.getters['table/document/get'](documentId)["type"];
        this.documentType = documentType; // Fetch document type when study changes
      } else {
        this.documentId = 0;
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
    // // NOTE: commented out because this component is not used, and "studySessionGetByHash" was
    // // deleted because this was the only usage
    // this.$socket.emit("studySessionGetByHash", {
    //   studySessionHash: this.studySessionHash
    // });
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