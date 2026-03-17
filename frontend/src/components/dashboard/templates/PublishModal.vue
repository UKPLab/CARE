<template>
  <Modal ref="publishModal" name="templatePublish" :props="{templateId: id}">
    <template #title>
      Publish Template
    </template>
    <template #body>
      <div v-if="success">
        <div
          class="alert alert-success"
          role="alert"
        >
          Template successfully published!<br>
          The template is now {{ visibilityMessage }}.
        </div>
      </div>
      <div v-else>
        <div v-if="isEmailTemplate" class="alert alert-info mb-3" role="alert">
          Email templates are only {{ visibilityMessage }} after publishing.
        </div>
        Do you really want to publish the template? <br>
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

/* PublishModal.vue - modal for publishing a template

The modal for publishing a template.

Author: Mohammad Elwan
*/
export default {
  name: "PublishModal",
  components: {Modal, BasicButton},
  subscribeTable: ["template"],
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
    template() {
      return this.$store.getters["table/template/get"](this.id);
    },
    isEmailTemplate() {
      return this.template && [1, 2, 3, 6].includes(this.template.type);
    },
    visibilityMessage() {
      return this.isEmailTemplate
        ? "visible to other administrators"
        : "visible to all users";
    },
  },
  methods: {
    open(id) {
      this.id = id;
      this.success = false;
      if (this.template && this.template.public) {
        this.success = true;
      }
      this.$refs.publishModal.openModal();
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "openModalPublishTemplate",
          data: {templateId: this.id}
        });
      }
    },
    publish() {
      this.$socket.emit("templateUpdate", {
        id: this.id,
        public: true,
      }, (res) => {
          if (!res.success) {
            this.$refs.publishModal.close();
            this.eventBus.emit("toast", {
              title: "Template not published",
              message: res.message,
              variant: "danger",
            });
          } else {
            this.success = true;
            this.$refs.publishModal.waiting = false;
            this.eventBus.emit('toast', {
              title: "Template published",
              message: `The template is now ${this.visibilityMessage}`,
              variant: "success"
            });
          }
        });

      this.$refs.publishModal.waiting = true;
    },
    close() {
      this.$refs.publishModal.close();
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "cancelModalPublishTemplate",
          data: {templateId: this.id}
        });
      }
    },
  }
}
</script>

<style scoped>

</style>
