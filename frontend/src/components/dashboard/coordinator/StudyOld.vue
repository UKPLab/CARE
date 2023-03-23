<template>
  <Modal
      ref="studyCoordinatorModal"
      :props="{studyId: studyId, documentId: documentId, resets: resets}"
      lg
      name="studyCoordinatorModal"
      @hide="reset"
  >
    <template #title>
      <span>
        Study Coordinator
      </span>
    </template>
    <template #body>
      <span v-if="success">
        The study has been successfully published<br>
        Participants can join the study under the following link:<br><br>
        <a
            :href="link"
            target="_blank"
        >{{ link }}</a>
      </span>
      <span v-else>
        <BasicForm
            v-model="study"
            :fields="dynamicFields.concat(staticFields)"
        />
      </span>
    </template>
    <template #footer>
      <span
          v-if="success"
          class="btn-group"
      >
        <button
            class="btn btn-secondary"
            @click="close"
        >Close</button>
        <button
            class="btn btn-primary"
            @click="copyURL"
        >Copy Link</button>
      </span>
      <span
          v-else
          class="btn-group"
      >
        <button
            class="btn btn-secondary"
            type="button"
            @click="close"
        >Cancel</button>
        <button
            class="btn btn-primary me-2"
            type="button"
            @click="publish"
        >
          {{ studyId === 0 ? "Start User Study" : "Update User Study" }}
        </button>
      </span>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import BasicForm from "@/basic/form/Form.vue";

/* StudyModal.vue - modal allowing coordinators to enter details

Modal with a form to enter study details.

Author: Dennis Zyska
Source: -
*/
export default {
  name: "StudyCoordinatorModal",
  components: {Modal, BasicForm},
  data() {
    return {
      studyId: 0,
      documentId: 0,
      defaultValue: {
        name: "",
        documentId: 0,
        collab: false,
        resumable: true,
        timeLimit: 0,
        description: "",
        start: null,
        end: null,
      },
      study: {},
      dynamicFields: [],
      staticFields: [
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
  watch: {
    newStudyData() {
      this.study = this.newStudyData;
    },
  },
  computed: {
    docs() {
      return this.$store.getters['document/getDocuments'];
    },
    newStudyData() {
      // eslint-disable-next-line no-unused-vars
      const resetCounter = this.resets; //do not remove; need for refreshing study object on modal hide!
      if (this.studyId === 0) {
        let defaultObject = {...this.defaultValue};
        defaultObject.documentId = this.documentId;
        return defaultObject;
      } else {
        return {...this.$store.getters['study/getStudyById'](this.studyId)};
      }
    },
    link() {
      return window.location.origin + "/study/" + this.hash;
    },
  },
  beforeMount() {
    this.study = this.defaultValue;
  },
  mounted() {
    // make sure the document list is up-to-date
    this.$socket.emit("documentGetAll");
  },
  methods: {
    open(studyId, documentId = null, loadInitialized = false) {
      if (documentId !== null) {
        this.documentId = documentId;
      }
      this.studyId = studyId;
      this.hash = this.studyId !== 0 ? this.study.hash : this.hash;
      this.success = loadInitialized;

      //load dynamic fields on opening
      this.dynamicFields = [{
        name: "documentId",
        label: "Selected document for the study:",
        type: "select",
        options: this.$store.getters["document/getDocuments"].map(document => {
          return {"value": document.id, "name": document.name}
        }),
        icon: "file-earmark",
        required: true,
      }];

      this.$refs.studyCoordinatorModal.openModal();
    },
    publish() {
      this.sockets.subscribe("studyPublished", (data) => {
        this.sockets.unsubscribe('studyPublished');
        if (data.success) {
          this.success = true;
          this.hash = data.studyHash;

          this.$refs.studyCoordinatorModal.waiting = false;

          this.eventBus.emit('toast', {
            title: "Study published",
            message: "Successfully started study!",
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