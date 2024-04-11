<template>
  <Loader
      v-if="documentId === 0"
      :loading="true"
      class="pageLoader"
  />
  <span v-else>
    <Editor v-if="document.type === 1" ref="editor"/>
    <Annotater v-else ref="annotator"/>
  </span>
</template>

<script>
/**
 * Standard document view without sessions, studies or reviews
 *
 * Loads a document, allows the user to annotate the document. The annotations are not associated with a study or
 * session. The users may simply share the link to this view after publication, to allow other users to
 * collaboratively work on a paper.
 *
 * @author: Dennis Zyska, Nils Dycke
 */

import Annotater from "./annotater/Annotater.vue";
import Loader from "@/basic/Loading.vue";
import {computed} from "vue";
import Editor from "@/components/annotater/Editor.vue"

export default {
  name: "DocumentRoute",
  components: {Annotater, Loader, Editor},
  provide() {
    return {
      documentId: computed(() => this.documentId),
    }
  },
  async beforeRouteLeave(to, from) {
    return await this.confirmLeave();
  },
  props: {
    'documentHash': {
      type: String,
      required: true
    },
  },
  data() {
    return {
      documentId: 0
    }
  },
  computed: {
    document() {
      return this.$store.getters["table/document/getByHash"](this.documentHash);
    },
  },
  watch: {
    document(newVal) {
      if (newVal) {
        this.documentId = newVal.id;
      } else {
        this.documentId = 0
      }
    },
  },
  mounted() {
    this.$socket.emit("documentGetByHash", {documentHash: this.documentHash});
  },
  sockets: {
    documentError: function (data) {
      if (data.documentHash === this.documentHash) {
        this.eventBus.emit('toast', {
          title: "Document Error",
          message: data.message,
          variant: "danger"
        });
        this.$router.push("/");
      }
    }
  },
  methods: {
    async confirmLeave() {
      if (this.$refs.annotator) {
        return await this.$refs.annotator.leave();
      } else if(this.$refs.editor) {
        return await this.$refs.editor.leave();
      }
    }
  }
}
</script>

<style scoped>
.pageLoader {
  position: absolute;
  top: 25%;
  left: 50%;
  transform: translate(-50%, -50%)
}
</style>