<template>
  <Modal ref="studyCoordinatorModal" lg>
    <template v-slot:title>
      <span>
        Study Coordinator - Create a user study
      </span>
    </template>
    <template v-slot:body>
      <Form :data="data" :fields="fields"></Form>
    </template>

    <template v-slot:footer>
      <span v-if="success" class="btn-group">
        <button class="btn btn-secondary" @click="close">Close</button>
        <button class="btn btn-primary" @click="copyURL">Copy Link</button>
      </span>
      <span v-else class="btn-group">
        <button class="btn btn-secondary" type="button" @click="close">Cancel</button>
        <button class="btn btn-primary me-2" type="button" @click="publish">Start User Study</button>
      </span>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import Form from "@/basic/form/Form.vue";

export default {
  name: "StudyCoordinatorModal.vue",
  components: {Modal, Form},
  data() {
    return {
      data: {
        name: "",
        documentId: 0,
        collab: false,
        resumable: true,
        levels: 1,
        timeLimit: 0,
        start: null,
        end: "2023-02-03T10:31:56.427Z",
      },
      fields: [
        {
          name: "documentId",
          label: "Selected document for user study",
          type: "select",
          options: this.$store.getters["document/getDocuments"].map(document => {
            return {"value": document.id, "name": document.name}
          }),
          icon: "file-earmark",
          required: true,
        },
        {
          name: "name",
          label: "Name of the user study",
          placeholder: "My user study",
          type: "text",
          required: true,
        },
        {
          name: "timeLimit",
          type: "slider",
          label: "How many time does a participant have for the study?",
          help: "0 = disable time limitation",
          size: 12,
          unit: "min",
          min: 0,
          max: 180,
          step: 10,
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
          label: "User study sessions can't start before",
          type: "datetime",
            size: 6,
          required: true,
        },
          {
          name: "end",
          label: "User study sessions can't start after:",
          type: "datetime",
            size: 6,
          required: true,
        },
      ],
      success: false,
    }
  },
  computed: {
    document() {
      return this.$store.getters["document/getDocument"](this.id);
    },
    link() {
      return window.location.origin + "/annotate/" + this.document.hash;
    }
  },
  methods: {
    open(id) {
      this.data.documentId = id;
      this.success = false;
      this.$refs.studyCoordinatorModal.openModal();
      this.$socket.emit("stats", {
        action: "openModalDocumentStudyCoordinator",
        data: {documentId: this.id}
      });
    },
    publish() {
      console.log(this.data);
      /*
      this.sockets.subscribe("documentPublished", (data) => {
        this.sockets.unsubscribe('documentPublished');
        if (data.success) {
          this.success = true;
          this.$refs.publishModal.waiting = false;
          this.eventBus.emit('toast', {
            title: "Document published",
            message: "Successful published tagset!",
            variant: "success"
          });
        } else {
          this.$refs.publishModal.closeModal();
          this.eventBus.emit('toast', {title: "Document not published", message: data.message, variant: "danger"});
        }
      });
      this.$socket.emit("documentPublish", {documentId: this.id});
      this.$refs.publishModal.waiting = true;
      */

    },
    close() {
      this.$refs.publishModal.closeModal();
      this.$socket.emit("stats", {
        action: "cancelModalPublishDocument",
        data: {documentId: this.id}
      });
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