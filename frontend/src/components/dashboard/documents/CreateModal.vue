<template>
  <Modal ref="createModal" lg name="documentUpload">
    <template #title>Create new document</template>
    <template #body>
      <div class="modal-body justify-content-center flex-grow-1 d-flex">
        <div class="flex-grow-1">
          <label class="form-label">Name of the document:</label>
          <input class="form-control" name="file" type="text" v-model="name"
                 @keyup.enter="create"/>
        </div>
      </div>
    </template>
    <template #footer>
      <div>
        <button class="btn btn-secondary" data-bs-dismiss="modal" type="button">
          Close
        </button>
        <button class="btn btn-primary" type="button" @click="create"
                @keyup.enter="create">
          Create
        </button>
      </div>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";

/**
 * Document create component
 *
 * This component provides the functionality for creating a document
 * on the server.
 *
 * @author: Dennis Zyska, Juliane Bechert, Zheyu Zhang
 */
export default {
  name: "DocumentCreateModal",
  components: {Modal},
  data() {
    return {
      name: "",
    };
  },
  methods: {
    open() {
      this.name = "";
      this.$refs.createModal.openModal();
    },
    create() {
      if (this.name.length === 0) {
        this.eventBus.emit("toast", {
          title: "No name for document",
          message: "Please enter a name for the document!",
          variant: "danger",
        });
        return;
      }
      this.$refs.createModal.waiting = true;

      this.$socket.emit("documentCreate", {
        type: 1,
        name: this.name,
      }, (res) => {
        if (res.success) {
          this.$refs.createModal.close();
          this.eventBus.emit("toast", {
            message: "Document successfully created!",
            title: "Success",
            variant: "success",
          });
        } else {
          this.$refs.createModal.waiting = false;
          this.eventBus.emit("toast", {
            message: res.message,
            title: "Error",
            variant: "danger",
          });
        }
      });
    },
  },
};
</script>
