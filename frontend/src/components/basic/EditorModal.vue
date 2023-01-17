<template>
  <Modal ref="editorModal" lg>
    <template v-slot:title>
      <h5 class="modal-title">{{ title }}</h5>
    </template>
    <template v-slot:body>
      <Editor ref="editor" :content="content"></Editor>
    </template>
    <template v-slot:footer>
      <button class="btn btn-secondary" data-bs-dismiss="modal" type="button"
              v-on:click="$refs.editorModal.closeModal()">Close
      </button>
      <button class="btn btn-primary" data-bs-dismiss="modal" type="button" v-on:click="saveEditor()">Save changes
      </button>
    </template>
  </Modal>
</template>

<script>
import Editor from "./Editor.vue";
import Modal from "./Modal.vue";

export default {
  name: "EditorModal.vue",
  components: {Editor, Modal},
  props: {
    title: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: false,
      default: ""
    }
  },
  methods: {
    open() {
      this.$refs.editorModal.openModal();
    },
    saveEditor() {
      this.$emit('save', this.$refs.editor.editor.getHTML());
      this.$refs.editorModal.closeModal();
    }
  }
}
</script>

<style scoped>

</style>