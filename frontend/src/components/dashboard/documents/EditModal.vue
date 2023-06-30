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
import BasicCoordinator from "@/basic/Coordinator.vue";

/* EditModal.vue - modal for editing a document

The modal for editing a document.

Author: Nils Dycke
Source: -
*/
export default {
  name: "EditModal",
  components: {BasicCoordinator},
  data() {
    return {
      id: 0,
      data: {},
      editTimeout : null
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
      this.sockets.subscribe("documentRefresh", (data) => {
        if (data.filter(d => d.id === this.id).length > 0) {
          if(this.editTimeout){
            clearTimeout(this.editTimeout);
          }

          this.sockets.unsubscribe('documentRefresh');
          this.$refs.coord.waiting = false;

          this.eventBus.emit('toast', {
            title: "Document edited",
            message: "Successfully edited document!",
            variant: "success"
          });

          this.$refs.coord.close();
        }
      });

      this.$socket.emit("appDataUpdate", {table: "document", data: {...doc, id: this.id}});

      this.editTimeout = setTimeout(() => {
          this.editTimeout = null;
          this.sockets.unsubscribe('documentRefresh');

          this.eventBus.emit('toast', {
            title: "Document edit failed",
            message: "Failed to edited document!",
            variant: "danger"
          });

          this.$refs.coord.close();
        }, 5000);
    }
  }
}
</script>

<style scoped>

</style>