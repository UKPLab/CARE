<template>
  <div>
    <Card title="Admin Tools">
      <template #body>
        <p class="text-muted mb-3">
          Administrative utilities for recovering and maintaining system files.
          Open a tool below to run a specific admin action.
        </p>

        <div class="d-flex flex-column gap-2 align-items-start">
          <BasicButton
              class="btn btn-outline-secondary"
              text="Replace document file"
              title="Replace an existing PDF or ZIP file on disk"
              icon="arrow-repeat"
              @click="openReplaceDocumentFileModal"
          />
        </div>
      </template>
    </Card>

    <ReplaceDocumentFileModal
        v-if="modals.replaceDocumentFile"
        ref="replaceDocumentFileModal"
        @hide="modals.replaceDocumentFile = false"
    />
  </div>
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicButton from "@/basic/Button.vue";
import ReplaceDocumentFileModal from "@/components/dashboard/admin_tools/ReplaceDocumentFileModal.vue";

/**
 * Admin Tools dashboard page.
 *
 * Extensible list of admin utilities; each tool opens its own modal.
 * Tool modals mount only while open so their table subscriptions stay idle.
 *
 * @author Mohammad Elwan
 */
export default {
  name: "AdminTools",
  components: {
    Card,
    BasicButton,
    ReplaceDocumentFileModal,
  },
  data() {
    return {
      modals: {
        replaceDocumentFile: false,
      },
    };
  },
  methods: {
    /**
     * Mount and open the document file replace modal.
     */
    openReplaceDocumentFileModal() {
      this.modals.replaceDocumentFile = true;
      this.$nextTick(() => this.$refs.replaceDocumentFileModal?.open());
    },
  },
};
</script>

<style scoped>
</style>
