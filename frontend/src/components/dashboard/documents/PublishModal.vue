<template>
  <Modal ref="publishModal" name="documentPublish" :props="{documentId: id}">
    <template #title>
      {{ $t('documents.publishDocument') }}
    </template>
    <template #body>
      <div v-if="success">
        <div
          class="alert alert-success"
          role="alert"
        >
          {{ $t('documents.messages.documentPublished') }}<br>
          {{ $t('documents.messages.documentAvailableAt') }}<br><br>
          <a
            :href="link"
            target="_blank"
          >{{ link }}</a>
        </div>
      </div>
      <div v-else>
        {{ $t('documents.messages.publishConfirm') }} <br>
        <b>{{ $t('documents.messages.cannotBeUndone') }}</b>
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
          :title="$t('common.close')"
        />
        <BasicButton
          class="btn btn-primary"
          :title="$t('studies.copyLink')"
          @click="copyURL"
        />
      </span>
      <span
        v-else
        class="btn-group"
      >
        <BasicButton
          class="btn btn-secondary"
          :title="$t('common.abort')"
          @click="close"
        />
        <BasicButton
          class="btn btn-danger me-2"
          :title="$t('documents.yesPublish')"
          @click="publish"
        />
      </span>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import { resolveApiMessage } from "@/assets/utils";

/* PublishModal.vue - modal for publishing a document

The modal for publishing a document.

Author: Dennis Zyska
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
      this.$socket.emit("documentPublish", {documentId: this.id}, (res) => {
          if (!res.success) {
            this.$refs.publishModal.close();
            this.eventBus.emit("toast", {
              title: this.$t('errors.documents.documentNotPublished'),
              message: resolveApiMessage(res),
              variant: "danger",
            });
          } else {
            this.success = true;
            this.$refs.publishModal.waiting = false;
            this.eventBus.emit('toast', {
              title: this.$t('documents.messages.documentPublishedTitle'),
              message: this.$t('documents.messages.publishedSuccess'),
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
          action: "cancelModalPublishDocument",
          data: {documentId: this.id}
        });
      }
    },
    async copyURL() {
      try {
        await navigator.clipboard.writeText(this.link);
        this.eventBus.emit('toast', {
          title: this.$t('studies.messages.linkCopied'),
          message: this.$t('documents.messages.linkCopiedMessage'),
          variant: "success"
        });
      } catch ($e) {
        this.eventBus.emit('toast', {
          title: this.$t('errors.clipboard.linkNotCopied'),
          message: this.$t('errors.clipboard.copyFailed'),
          variant: "danger"
        });
      }
    }
  }
}
</script>

<style scoped>

</style>