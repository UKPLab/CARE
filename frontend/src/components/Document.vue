<template>
  <Loader v-if="documentId === 0" :loading="true" class="pageLoader"/>
  <Annotater v-else :document-id="documentId"/>
</template>

<script>
import Annotater from "./Annotater.vue";
import Loader from "@/basic/Loader.vue";

export default {
  name: "Document",
  components: {Annotater, Loader},
  props: {
    'documentHash': {
      type: String,
      required: true,
    },
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
  methods: {
    load() {
      this.$socket.emit("documentGetByHash", {documentHash: this.documentHash})
    },
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