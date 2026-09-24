<template>
  <Modal ref="publishModal" name="templatePublish" :props="{templateId: id}">
    <template #title>
      {{ $t("templates.publishModal.title") }}
    </template>
    <template #body>
      <div v-if="success">
        <div
          class="alert alert-success"
          role="alert"
        >
          {{ $t("templates.publishModal.success.published") }}<br>
          {{ $t("templates.publishModal.success.visibility", { visibility: visibilityMessage }) }}
        </div>
      </div>
      <div v-else>
        <div v-if="isEmailTemplate" class="alert alert-info mb-3" role="alert">
          {{ $t("templates.publishModal.emailTemplateVisibilityInfo", { visibility: visibilityMessage }) }}
        </div>
        {{ $t("templates.publishModal.confirmQuestion") }} <br>
        <b>{{ $t("templates.publishModal.cannotBeUndone") }}</b>
      </div>
    </template>

    <template #footer>
      <span
        v-if="success"
        class="btn-group"
      >
        <BasicButton
          class="btn btn-secondary"
          :title="$t('common.close')"
          @click="close"
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
          :title="$t('templates.publishModal.confirmPublish')"
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
      return this.template && [1, 2, 3, 6, 7].includes(this.template.type);
    },
    visibilityMessage() {
      return this.isEmailTemplate
        ? this.$t("templates.publishModal.visibility.administrators")
        : this.$t("templates.publishModal.visibility.allUsers");
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
      this.$socket.emit("appDataUpdate", {
        table: "template",
        data: {
          id: this.id,
          public: true,
        },
      }, (res) => {
          if (!res.success) {
            this.$refs.publishModal.close();
            this.eventBus.emit("toast", {
              title: this.$t("templates.publishModal.errors.notPublished"),
              message: resolveApiMessage(res),
              variant: "danger",
            });
          } else {
            this.success = true;
            this.$refs.publishModal.waiting = false;
            this.eventBus.emit("toast", {
              title: this.$t("templates.publishModal.success.title"),
              message: this.$t("templates.publishModal.success.visibility", { visibility: this.visibilityMessage }),
              variant: "success",
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
