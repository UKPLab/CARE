<template>
  <Modal ref="editorModal" :props="$props" lg name="editorModal">
    <template #title>
      <h5 class="modal-title">{{ title }}</h5>
    </template>
    <template #body>
      <Editor ref="editor" v-model="currentData"></Editor>
    </template>
    <template #footer>
      <button class="btn btn-secondary" data-bs-dismiss="modal" type="button"
              @click="$refs.editorModal.close()">Close
      </button>
    </template>
  </Modal>
  <LoadIcon class="mx-2" icon-name="border-style"
            @click="open()"></LoadIcon>
</template>

<script>
import Editor from "./Editor.vue";
import Modal from "@/basic/Modal.vue";
import LoadIcon from "@/icons/LoadIcon.vue";

export default {
  name: "EditorModal",
  components: {Editor, Modal, LoadIcon},
  props: {
    title: {
      type: String,
      required: true
    },
    modelValue: {
      type: String,
      required: false,
      default: "",
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      currentData: "",
    }
  },
  watch: {
    currentData() {
      this.$emit("update:modelValue", this.currentData);
    },
    modelValue() {
      this.currentData = this.modelValue;
    },
  },
  mounted() {
    this.currentData = this.modelValue;
  },
  methods: {
    open() {
      this.$refs.editorModal.openModal();
    },
  }
}
</script>

<style scoped>

</style>