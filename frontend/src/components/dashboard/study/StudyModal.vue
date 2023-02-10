<template>
  <Modal ref="studyCoordinatorModal" lg name="studyCoordinatorModal" @hide="reset"
         :props="{studyId: studyId, documentId: documentId}">
    <template v-slot:title>
      <span>
        Study Coordinator
      </span>
    </template>
    <template v-slot:body>
      <span v-if="success">
        The study has been successfully published<br>
        Participants can join the study under the following link:<br><br>
          <a :href="link" target="_blank">{{ link }}</a>
      </span>
      <span v-else>
        <Form v-model="study" :fields="fields"></Form>
      </span>
    </template>
    <template v-slot:footer>
      <span v-if="success" class="btn-group">
        <button class="btn btn-secondary" @click="close">Close</button>
        <button class="btn btn-primary" @click="copyURL">Copy Link</button>
      </span>
      <span v-else class="btn-group">
        <button class="btn btn-secondary" type="button" @click="close">Cancel</button>
        <button class="btn btn-primary me-2" type="button" @click="publish">
          {{ this.studyId === 0 ? "Start User Study" : "Update User Study" }}
        </button>
      </span>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import Form from "@/basic/form/Form.vue";

export default {
  name: "StudyCoordinatorModal",
  components: {Modal, Form},
  data() {
    return {
      studyId: 0,
      documentId: 0,
      defaultValue: {
          name: "",
          documentId: this.documentId,
          collab: false,
          resumable: true,
          levels: 1,
          timeLimit: 0,
          description: "",
          start: null,
          end: null,
        },
      fields: [
        {
          name: "documentId",
          label: "Selected document for the study:",
          type: "select",
          options: this.$store.getters["document/getDocuments"].map(document => {
            return {"value": document.id, "name": document.name}
          }),
          icon: "file-earmark",
          required: true,
        },
        {
          name: "name",
          label: "Name of the study:",
          placeholder: "My user study",
          type: "text",
          required: true,
        },
        {
          name: "description",
          label: "Description of the study:",
          help: "This text will be displayed at the beginning of the user study!",
          type: "editor",
        },
        {
          name: "timeLimit",
          type: "slider",
          label: "How much time does a participant have for the study?",
          help: "0 = disable time limitation",
          size: 12,
          unit: "min",
          min: 0,
          max: 180,
          step: 1,
          required: false,
        },
        {
          name: "collab",
          label: "Should the study be collaborative?",
          type: "switch",
          required: true,
        },
        {
          name: "resumable",
          label: "Should the study be resumable?",
          type: "switch",
          required: true,
        },
        {
          name: "levels",
          label: "How many reviews are possible for each session?",
          type: "slider",
          min: 1,
          step: 1,
          max: 5,
          required: true,
        },
        {
          name: "start",
          label: "Study sessions can't start before",
          type: "datetime",
          size: 6,
          required: true,
        },
        {
          name: "end",
          label: "Study sessions can't start after:",
          type: "datetime",
          size: 6,
          required: true,
        },
      ],
      success: false,
      hash: null,
      resets: 0,
    }
  },
  computed: {
    study() {
      const resetCounter = this.resets; //do not remove; need for refreshing study object on modal hide!
      if (this.studyId === 0) {
        return {...this.defaultValue};
      } else {
        return {...this.$store.getters['study/getStudyById'](this.studyId)};
      }
    },
    link() {
      return window.location.origin + "/study/" + this.hash;
    },
  },
  methods: {
    open(studyId, documentId = null, loadInitialized = false) {
      if (documentId !== null) {
        this.documentId = documentId;
      }
      this.studyId = studyId;
      this.hash = this.studyId !== 0 ? this.study.hash : this.hash;
      this.success = loadInitialized;
      this.$refs.studyCoordinatorModal.openModal();
    },
    publish() {
      this.sockets.subscribe("studyPublished", (data) => {
        this.sockets.unsubscribe('studyPublished');
        if (data.success) {
          this.success = true;
          this.studyId = data.id;
          this.hash = data.hash;
          this.$refs.studyCoordinatorModal.waiting = false;

          this.eventBus.emit('toast', {
            title: "Study published",
            message: "Successful started study!",
            variant: "success"
          });
        } else {
          this.$refs.studyCoordinatorModal.closeModal();

          this.eventBus.emit('toast', {title: "Study not published", message: data.message, variant: "danger"});
        }
      });
      this.$socket.emit("studyPublish", this.study);
      this.$refs.studyCoordinatorModal.waiting = true;
    },
    close() {
      this.$refs.studyCoordinatorModal.closeModal();
    },
    reset() {
      this.resets++;
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