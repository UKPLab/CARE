<template>
  <Modal ref="modal" name="publicTemplates" size="xl">
    <template #title>
      {{ $t("templates.publicTemplates.title") }}
    </template>
    <template #body>
      <p class="text-muted mb-3">
        {{ $t("templates.publicTemplates.description") }}
      </p>
      <BasicTable
        :columns="columns"
        :data="publicTemplates"
        :options="tableOptions"
        :buttons="buttons"
        @action="action"
      />
    </template>
    <template #footer>
      <BasicButton
        class="btn btn-secondary"
        :title="$t('common.close')"
        @click="close"
      />
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import { otherTemplateTypes } from "@/assets/templateTypes";
import { resolveApiMessage } from "@/assets/utils";

/**
 * PublicTemplatesModal - modal for browsing and copying public templates
 *
 * Displays published templates from other users with View and Copy actions.
 * Copy is disabled if the user already has a copy of that template.
 *
 * @author Mohammad Elwan
 */
export default {
  name: "PublicTemplatesModal",
  components: { Modal, BasicTable, BasicButton },
  subscribeTable: ["template"],
  data() {
    return {
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
      },
    };
  },
  computed: {
    columns() {
      return [
        { name: this.$t("common.id"), key: "id" },
        { name: this.$t("common.name"), key: "name", sortable: true },
        { name: this.$t("common.type"), key: "typeName", sortable: true },
        { name: this.$t("common.updatedAt"), key: "updatedAt", sortable: true, type: "datetime" },
        { name: this.$t("common.status"), key: "copyStatus", type: "badge" },
      ];
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    ownTemplates() {
      return this.$store.getters["table/template/getAll"]
        .filter(t => t.userId === this.userId && !t.deleted);
    },
    publicTemplates() {
      const isAdmin = this.$store.getters["auth/isAdmin"];
      return this.$store.getters["table/template/getAll"]
        .filter(t => t.public && t.userId !== this.userId && !t.deleted)
        .filter(t => isAdmin || otherTemplateTypes.includes(t.type))
        .map(t => {
          const alreadyCopied = this.ownTemplates.some(
            own => own.sourceId === t.id
          );
          return {
            ...t,
            typeName: this.typeName(t.type),
            alreadyCopied,
            canCopy: !alreadyCopied,
            copyStatus: alreadyCopied ? { text: this.$t("templates.publicTemplates.alreadyCopied"), class: "bg-secondary" } : { text: "", class: "" },
          };
        });
    },
    buttons() {
      return [
        {
          icon: "eye",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
          title: this.$t("templates.publicTemplates.viewContentReadOnly"),
          action: "view",
        },
        {
          icon: "clipboard-plus",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-primary": true,
            },
          },
          filter: [{ key: "canCopy", value: true }],
          title: this.$t("templates.publicTemplates.copyToMyTemplates"),
          action: "copy",
        },
        {
          icon: "clipboard-check",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
              disabled: true,
            },
          },
          filter: [{ key: "alreadyCopied", value: true }],
          title: this.$t("templates.publicTemplates.alreadyCopied"),
          action: null,
        },
      ];
    },
  },
  methods: {
    open() {
      this.$refs.modal.openModal();
    },
    close() {
      this.$refs.modal.close();
    },
    typeName(type) {
      switch (type) {
        case 1: return this.$t("templates.types.emailGeneral");
        case 2: return this.$t("templates.types.emailStudySession");
        case 3: return this.$t("templates.types.emailAssignment");
        case 4: return this.$t("templates.types.documentGeneral");
        case 5: return this.$t("templates.types.documentStudy");
        case 6: return this.$t("templates.types.emailStudyClose");
        case 7: return this.$t("templates.types.emailSubmissionUpload");
        default: return this.$t("common.unknown");
      }
    },
    action(data) {
      switch (data.action) {
        case "view":
          this.close();
          this.$router.push(`/template/${data.params.id}`);
          break;
        case "copy":
          this.copyTemplate(data.params);
          break;
      }
    },
    copyTemplate(template) {
      this.$socket.emit("templateCopy", {
        sourceTemplateId: template.id,
      }, (result) => {
        if (result.success) {
          this.eventBus.emit("toast", {
            title: this.$t("templates.publicTemplates.success.title"),
            message: this.$t("templates.publicTemplates.success.message"),
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: this.$t("templates.publicTemplates.errors.copyFailed"),
            message: resolveApiMessage(result),
            variant: "danger",
          });
        }
      });
    },
  },
};
</script>

<style scoped>
</style>
