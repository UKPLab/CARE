<template>
  <Modal ref="modal" name="publicTemplates" size="xl">
    <template #title>
      Public Templates
    </template>
    <template #body>
      <p class="text-muted mb-3">
        Browse published templates from other users. Copy a template to add it to your own list.
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
        title="Close"
        @click="close"
      />
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";

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
      columns: [
        { name: "ID", key: "id" },
        { name: "Name", key: "name", sortable: true },
        { name: "Type", key: "typeName", sortable: true },
        { name: "Updated At", key: "updatedAt", sortable: true, type: "datetime" },
        { name: "Status", key: "copyStatus", type: "badge" },
      ],
    };
  },
  computed: {
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    ownTemplates() {
      return this.$store.getters["table/template/getAll"]
        .filter(t => t.userId === this.userId && !t.deleted);
    },
    publicTemplates() {
      return this.$store.getters["table/template/getAll"]
        .filter(t => t.public && t.userId !== this.userId && !t.deleted)
        .map(t => {
          const alreadyCopied = this.ownTemplates.some(
            own => own.sourceId === t.id
          );
          return {
            ...t,
            typeName: this.typeName(t.type),
            alreadyCopied,
            canCopy: !alreadyCopied,
            copyStatus: alreadyCopied ? { text: "Already copied", class: "bg-secondary" } : { text: "", class: "" },
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
          title: "View content (read-only)",
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
          title: "Copy to my templates",
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
          title: "Already copied",
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
        case 1: return "Email - General";
        case 2: return "Email - Study Session";
        case 3: return "Email - Assignment";
        case 4: return "Document - General";
        case 5: return "Document - Study";
        case 6: return "Email - Study Close";
        case 7: return "Email - Submission upload";
        default: return "Unknown";
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
            title: "Template copied",
            message: "Template copied to your list",
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: "Copy failed",
            message: result.message,
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
