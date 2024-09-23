<template>
  <Modal ref="publishModal" name="documentPublish" :props="{documentId: id}">
    <template #title>
      Publish Document
    </template>
    <template #body>
      <div v-if="success">
        <div
          class="alert alert-success"
          role="alert"
        >
          Document successfully published!<br>
          The document is available under the following link:<br><br>
          <a
            :href="link"
            target="_blank"
          >{{ link }}</a>
        </div>
      </div>
      <div v-else>
        Do you really want to publish the document? <br>
        <b>This can not be undone!</b>
      </div>
    </template>

    <template #footer>
      <span
        v-if="success"
        class="btn-group"
      >
        <BasicButton
          class="btn btn-secondary"
          @click="close"
          title="Close"
        />
        <BasicButton
          class="btn btn-primary"
          title="Copy Link"
          @click="copyURL"
        />
      </span>
      <span
        v-else
        class="btn-group"
      >
        <BasicButton
          class="btn btn-secondary"
          title="Abort"
          @click="close"
        />
        <BasicButton
          class="btn btn-danger me-2"
          title="Yes, publish it!"
          @click="publish"
        />
      </span>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";

/* PublishModal.vue - modal for publishing a document

The modal for publishing a document.

Author: Dennis Zyska
Source: -
*/
export default {
  name: "PublishModal",
  components: {Modal, BasicButton},
  inject: {
    acceptStats: {
      default: () => false
    }
  },
  data() {
    return {
      id: 0,
      success: false,
    }
  },
  computed: {
    document() {
      return this.$store.getters["table/document/get"](this.id);
    },
    link() {
      return window.location.origin + "/document/" + this.document.hash;
    }
  },
  methods: {
    open(id) {
      this.id = id;
      this.success = this.document.public;
      this.$refs.publishModal.openModal();
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "openModalPublishDocument",
          data: {documentId: this.id}
        });
      }
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
          this.$refs.publishModal.close();
          this.eventBus.emit('toast', {title: "Document not published", message: data.message, variant: "danger"});
        }
      });
      this.$socket.emit("documentPublish", {documentId: this.id});
      this.$refs.publishModal.waiting = true;
    },
    close() {
      this.$refs.publishModal.close();
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "cancelModalPublishDocument",
          data: {documentId: this.id}
        });
      }
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