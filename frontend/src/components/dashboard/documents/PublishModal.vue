<template>
  <Modal ref="publishModal">
    <template v-slot:title>
      Publish Document
    </template>
    <template v-slot:body>
      <div v-if="success">
        <div class="alert alert-success" role="alert">
          Document successfully published!<br>
          The document is available under the following link:<br><br>
          <a :href="link" target="_blank">{{ link }}</a>
        </div>
      </div>
      <div v-else>
        Do you really want to publish the document? <br>
        <b>This can not be undone!</b>
      </div>
    </template>

    <template v-slot:footer>
      <span v-if="success">
        <button class="btn btn-secondary" @click="close">Close</button>
        <button class="btn btn-primary" @click="copyURL">Copy Link</button>
      </span>
      <span v-else>
        <button class="btn btn-secondary" type="button" @click="close">Abort</button>
        <button class="btn btn-danger me-2" type="button" @click="publish">Yes, publish it!</button>
      </span>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";

export default {
  name: "PublishModal.vue",
  components: {Modal},
  data() {
    return {
      id: 0,
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
      this.success = this.document.public;
      this.$refs.publishModal.openModal();
      this.$socket.emit("stats", {
        action: "openModalPublishDocument",
        data: {documentId: this.id}
      });
    },
    publish() {
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