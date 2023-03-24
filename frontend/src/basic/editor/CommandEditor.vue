<template>
  <div>
    <JsonEditor v-model:content="content" start-edit-mode/>
    <div class="justify-content-end">
      <div class="btn-group btn-group-sm">
        <button
            class="btn btn-outline-secondary"
            type="button"
            title="Send"
            @click="send"
        >
          <LoadIcon
              icon-name="send-exclamation"
              :size="16"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import JsonEditor from "./JsonEditor.vue";
import LoadIcon from "@/icons/LoadIcon.vue";

export default {
  name: "CommandEditor",
  components: {JsonEditor, LoadIcon},
  data() {
    return {
      content: {}
    }
  },
  methods: {
    send(){

    }
  }
}
</script>

<style scoped>

</style>