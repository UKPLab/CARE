<template>
  <BasicCoordinator
    ref="coord"
    :title="$t('documents.document')"
    :text-add="$t('common.add')"
    :text-update="$t('common.change')"
    :text-cancel="$t('common.abort')"
    table="document"
    :read-only-fields="readOnlyFields"
    @submit="update"
  >
    <template #success>
      {{ $t('documents.messages.documentEdited') }}
    </template>
  </BasicCoordinator>
</template>

<script>
import { resolveApiMessage } from "@/assets/utils";
import BasicCoordinator from "@/basic/dashboard/Coordinator.vue";

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
            title: this.$t('documents.messages.documentEditedTitle'),
            message: this.$t('documents.messages.documentEditedMessage'),
            variant: "success"
          });
        } else {
          this.eventBus.emit('toast', {
            title: this.$t('errors.documents.documentEditFailed'),
            message: resolveApiMessage(result),
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