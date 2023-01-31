<template>
  <Modal ref="studyCoordinatorModal" lg>
    <template v-slot:title>
      <span v-if="id !== 0">
        Study Coordinator for {{ document.name }}
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
      id: 0,
      data: {
        name: "",
        timeLimit: 0,
      },
      fields: [
        {
          name: "name",
          label: "Name of the user study",
          type: "text",
          required: true,
        },
        {
          name: "timeLimit",
          label: "Enable time limitation",
          type: "switch",
          size: 4,
          help: "If enabled, the user study will be automatically closed after the specified time limit.",
          required: false,
        },
        {
          name: "time",
          type: "text",
          label: "Time Limit (in minutes)",
          size: 12,
          required: false,
        }
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
      this.id = id;
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