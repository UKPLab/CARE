<template>
  <Modal ref="createModal" lg name="documentUpload">
    <template #title>Create new document</template>
    <template #body>
      <div class="modal-body justify-content-center flex-grow-1 d-flex">
        <div v-if="creating" class="spinner-border m-5" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <div v-else class="flex-grow-1">
          <label class="form-label">Name of the document:</label>
          <input class="form-control" name="file" type="text" v-model="name"
                 @keyup.enter="create" />  
        </div>
      </div>
    </template>
    <template #footer>
      <div v-if="!creating">
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
 * to the server.
 *
 * @author: Zheyu Zhang, Juliane Bechert
 */
export default {
  name: "DocumentCreateModal",
  components: { Modal },
  data() {
    return {
      creating: false,
      show: false,
      name: "",
    };
  },
  computed: {},
  mounted() {},
  sockets: {
    createResult: function (data) {
      this.$refs.createModal.close();
      this.creating = false;
      if (data.success) {
        this.eventBus.emit("toast", {
          message: "Document successfully created!",
          variant: "success",
          delay: 3000,
        });
      } else {
        this.eventBus.emit("toast", {
          message: "Error during create of document!",
          variant: "danger",
          delay: 3000,
        });
      }
    },
  },
  methods: {
    open() {
      this.name = "";

      this.$refs.createModal.openModal();
      this.$socket.emit("stats", { action: "openCreateModal", data: {} });
    },
    create() {
      // check if user had input document name
      if (this.name.length === 0) {
        alert("Please enter the name of the document.");
        return;
      }

      this.$socket.emit("documentCreate", {
        type: 1,
        name: this.name,
      });
      this.creating = true;
    },
  },
};
</script>
