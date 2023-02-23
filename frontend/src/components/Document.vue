<template>
  <Loader
    v-if="documentId === 0"
    :loading="true"
    class="pageLoader"
  />
  <Annotater
    v-else
    ref="annotator"
    :document-id="documentId"
  />
</template>

<script>
import Annotater from "./Annotater.vue";
import Loader from "@/basic/Loader.vue";

/* Document.vue - standard document view without sessions, studies or reviews

Loads a document, allows the user to annotate the document. The annotations are not associated with a study or
session. The users may simply share the link to this view after publication, to allow other users to
collaboratively work on a paper.

Author: Dennis Zyska
Co-author: Nils Dycke
Source: -
*/
export default {
  name: "Document",
  components: {Annotater, Loader},
  async beforeRouteLeave(to, from){
    return await this.confirmLeave();
  },
  props: {
    'documentHash': {
      type: String,
      required: true,
    },
  },
  computed: {
    document() {
      return this.$store.getters["document/getDocumentByHash"](this.documentHash);
    },
    documentId() {
      if (this.document) {
        return this.document.id;
      }
      return 0;
    }
  },
  mounted() {
    this.$socket.emit("documentGetByHash", {documentHash: this.documentHash})
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
    async confirmLeave(){
      return await this.$refs.annotator.leave();
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