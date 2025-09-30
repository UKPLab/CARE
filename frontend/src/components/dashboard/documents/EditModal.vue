<template>
  <BasicCoordinator
    ref="coord"
    title="Document"
    text-add="Add"
    text-update="Change"
    text-cancel="Abort"
    table="document"
    :read-only-fields="readOnlyFields"
    @submit="update"
  >
    <template #success>
      The document has been successfully edited.
    </template>
  </BasicCoordinator>
</template>

<script>
import BasicCoordinator from "@/components/dashboard/Coordinator.vue";

/* EditModal.vue - modal for editing a document

The modal for editing a document.

Author: Nils Dycke, Dennis Zyska
Source: -
*/
export default {
  name: "EditModal",
  components: {BasicCoordinator},
  data() {
    return {
      id: 0,
      data: {},
    }
  },
  computed: {
    document() {
      return this.$store.getters["table/document/get"](this.id);
    },
    readOnlyFields() {
      return this.$store.getters["table/document/getFields"].filter(f => f.key !== "name").map(f => f.key);
    }
  },
  methods: {
    open(id) {
      this.id = id;
      this.$refs.coord.open(id, this.document);
    },
    update(doc) {
      this.$socket.emit("appDataUpdate", {table: "document", data: {...doc, id: this.id}}, (result) => {
        if (result.success) {
          this.$refs.coord.waiting = false;

          this.eventBus.emit('toast', {
            title: "Document edited",
            message: "Successfully edited document!",
            variant: "success"
          });
        } else {
          this.eventBus.emit('toast', {
            title: "Document edit failed",
            message: result.message,
            variant: "danger"
          });
        }
        this.$refs.coord.close();
      });
    }
  }
}
</script>

<style scoped>

</style>