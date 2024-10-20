<template>
  <StudyModal
    v-if="studySessionId === 0"
    ref="studyModal"
    :study-id="studyId"
    @finish="finish"
    @start="start"
  />
  <FinishModal
    ref="studyFinishModal"
    :closeable="!timeUp && !studyClosed"
    :finished="finished"
    :study-session-id="studySessionId"
    @finish="finalFinish"
  />

  <Teleport to="#topbarCustomPlaceholder">  
  <div class="d-flex justify-content-between align-items-center w-100">
    <TopBarButton
      class="btn btn-outline-primary me-3"
      title = "Previous"
      :disabled="currentStep === 0"
      @click="previousStep"
    >
    Previous
    </TopBarButton>

    <TopBarbutton
      class="btn btn-outline-secondary mx-3"
      title="Finish Study"
      @click="finish"
    >
    Finish Study
    </TopBarButton>

    <TopBarbutton
      class="btn btn-outline-primary ms-3"
      title="Next"
      :disabled="currentStep === maxSteps - 1"
      @click="nextStep"
    >
    Next
    </TopBarButton>

    <TopbarButton
      v-if="timeLeft > 0"
      class="btn mb-1"
    >
    <LoadIcon
        :size="21"
        class="me-1 middle"
        icon-name="stopwatch"
      />
      <span
        :class="{'text-danger':timeLeft < (5 * 60)}"
        class="middle"
      ><b>Time Left:</b> {{ timeLeftHuman }}</span>
    </TopbarButton>
  </div>
  </Teleport>

  <Annotator
    v-if="documentId !== 0 && documentType === 0 && studySessionId !== 0"
  />
  <Editor
    v-if="documentId !== 0 && documentType === 1 && studySessionId !== 0"
  />
</template>


<script>
/**
 * Document view in study mode
 *
 * Loads a document in study mode; if a study session is provided, the session is loaded instead. Otherwise,
 * the user is prompted to start a study (or resume an existing session).
 *
 * @author Dennis Zyska
 */
import StudyModal from "@/components/study/StudyModal.vue";
import Annotator from "./annotator/Annotator.vue";
import Editor from "./editor/Editor.vue";
import FinishModal from "./study/FinishModal.vue";
import LoadIcon from "@/basic/Icon.vue";
import TopBarButton from "@/basic/navigation/TopBarButton.vue";
import { computed } from "vue";

export default {
  name: "StudyRoute",
  components: { LoadIcon, FinishModal, StudyModal, Annotator, Editor, TopBarButton },
  provide() {
    return {
      documentId: computed(() => this.documentId),
      studySessionId: computed(() => this.studySessionId),
      readonly: this.readonly,
    };
  },
  props: {
    'studyHash': {
      type: String,
      required: false,
      default: null
    },
    'initStudySessionId': {
      type: Number,
      required: false,
      default: 0,
    },
    'readonly': {
      type: Boolean,
      required: false,
      default: false,
    }
  },
  fetchData: ['study', 'study_session', 'document'],
  data() {
    return {
      studySessionId: 0,
      timeLeft: 0,
      timerInterval: null,
      documentId: 0,
      documentType: null,
      currentStep: 0, //dummy code for allowNaviagtion
      maxSteps: 2 //dummy code for allowNaviagtion
    };
  },
  computed: {
    allowNavigation() {
      return this.study ? this.study.allowNavigation : false;
    },
    studySession() {
      if (this.studySessionId !== 0) {
        return this.$store.getters['table/study_session/get'](this.studySessionId);
      }
      return null;
    },
    study() {
      if (this.studySession) {
        return this.$store.getters['table/study/get'](this.studySession.studyId);
      }
      if (this.studyHash) {
        return this.$store.getters['table/study/getByHash'](this.studyHash);
      }
      return null;
    },
    studyId() {
      if (this.study) {
        return this.study.id;
      } else
        return 0;
    },
    finished() {
      if (this.studySession) {
        return this.studySession.end !== null;
      }

      if(this.study && this.study.end) {     
        if (this.study.end !== null && this.study.end !== undefined) {
          if (!(this.study.end instanceof Date)) {
            throw new Error("Invalid type for study end date. Expected a Date object.");
          }
          return Date.now() > new Date(this.study.end);
        }
      }

      if(this.study && this.study.closed){
          if(this.study.closed !== null && this.study.closed !== undefined) {
            if (!(this.study.closed instanceof Date)) {
              throw new Error("Invalid type for study close date. Expected a Date object.");
            }
            return Date.now() > new Date(this.study.closed);
          }
      }

      return false;
    },
    timeUp() {
      if (this.study && this.study.timeLimit > 0) {
        if (this.timeLeft < 0) {
          return true;
        }
      }
      return false;
    },
    studyClosed() {
      if(this.study && this.study.closed) {
        if(this.study["closed"] !== null && this.study["closed"] !== undefined) {
          if(!(this.study["closed"] instanceof Date)) {
            throw new Error("Invalid type for study close date. Expected a Date object.");
          }
          return Date.now > new Date(this.study.closed);
        }
     }

     if(this.study && this.study.end) {
        if(this.study.end !== null && this.study.end !== undefined) {
          if(!(this.study.end instanceof Date)) {
            throw new Error("Invalid type for study end date. Expected a Date object.");
          }
          return Date.now() > new Date(this.study.end);
        }
      } 
             
      return false;
    },
    timeLeftHuman() {
      if (this.timeLeft < 60) {
        return Math.round(this.timeLeft) + "s";
      }
      return Math.round(this.timeLeft / 60) + "min";
    }
  },
  watch: {
    studySession(newVal) {
      if (this.study.timeLimit > 0 && this.studySession) {  //studySession required, otherwise not all data may be there yet
        if (this.timerInterval) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
        }

        this.calcTimeLeft();
        if (!newVal.end) {
          this.timerInterval = setInterval(this.calcTimeLeft, 1000);
        }
      }
    },
    study(newVal) {
      if (newVal) {
        //HARD CODED FOR NOW
        const documentId = newVal["studySteps"][0]["documentId"];
        const documentType = this.$store.getters['table/document/get'](documentId)["type"];        
        this.documentId = documentId;
        this.documentType = documentType; // Fetch document type when study changes
      } else {
        this.documentId = 0;
      }
    }
  },
  mounted() {
    this.studySessionId = this.initStudySessionId;
    console.log("studySessionId send from mounted:",this.studySessionId);
    if (this.studySessionId === 0) {
      this.$refs.studyModal.open();
      //TODO: check this part
      this.$socket.emit("studyGetByHash", { studyHash: this.studyHash });
    }
  },
  sockets: {
    studyError: function (data) {
      if (data.studyHash === this.studyHash) {
        this.eventBus.emit('toast', {
          title: "Study Error",
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
  methods: {
    start(data) {
      this.studySessionId = data.studySessionId;
    },
    finalFinish(data) {
      this.$socket.emit("studySessionUpdate", {
        sessionId: this.studySessionId,
        comment: data.comment,
        end: Date.now()
      });
    },
    finish(data) {
      if (data.studySessionId) {
        this.studySessionId = data.studySessionId;
      }

      if (this.finished && !this.study.multipleSubmit) {
        this.$refs.studyFinishModal.open();
        return;
      }
    },
    calcTimeLeft() {
      const timeSinceStart = (Date.now() - new Date(this.studySession.start)) / 1000;
      this.timeLeft = this.study.timeLimit * 60 - timeSinceStart;

      if (this.timeLeft < 0) {
        this.finish({ studySessionId: this.studySessionId });
      }
    },
    previousStep() {
      if (this.currentStep > 0) {
        this.currentStep--;
      }
    },
    nextStep() {
      if (this.currentStep < this.maxSteps - 1) {
        this.currentStep++;
      }
    }
  }
};
</script>

<style scoped>
.d-flex {
  width: 100%; 
}
.mx-auto {
  margin-left: auto; 
  margin-right: auto;
}
.me-3 {
  margin-right: 1rem; 
}
.ms-3 {
  margin-left: 1rem;
}
</style>