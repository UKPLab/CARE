<template>
  <div>
    <Card :title="$t('dashboard.adminTools.title')">
      <template #body>
        <p class="text-muted mb-3">
          {{ $t('dashboard.adminTools.description') }}
        </p>

        <div class="admin-tools">
          <BasicButton
            v-for="tool in tools"
            :key="tool.title"
            class="card admin-tool"
            @click="tool.open"
          >
            <span class="admin-tool-icon">
              <LoadIcon :icon-name="tool.icon" />
            </span>
            <b>{{ tool.title }}</b>
            <span class="text-secondary small">{{ tool.description }}</span>
          </BasicButton>
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
import LoadIcon from "@/basic/Icon.vue";
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
    LoadIcon,
    ReplaceDocumentFileModal,
  },
  data() {
    return {
      modals: {
        replaceDocumentFile: false,
      },
    };
  },
  computed: {
    tools() {
      return [{
        icon: "arrow-repeat",
        title: this.$t("dashboard.adminTools.replaceDocumentFile.button"),
        description: this.$t("dashboard.adminTools.replaceDocumentFile.buttonTitle"),
        open: () => this.openReplaceDocumentFileModal(),
      }];
    },
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
.admin-tools {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.admin-tool.btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  height: auto;
  padding: 16px;
  text-align: left;
  white-space: normal;
  color: inherit;
  background: var(--bs-body-bg);
  --bs-btn-hover-bg: var(--bs-body-bg);
  --bs-btn-hover-color: inherit;
  transition: box-shadow var(--care-dur-fast) var(--care-ease), border-color var(--care-dur-fast) var(--care-ease);
}

.admin-tool.btn:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--care-primary) 40%, transparent);
  box-shadow: var(--care-shadow-2);
}

.admin-tool-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  margin-bottom: 6px;
  border-radius: var(--bs-border-radius);
  background: color-mix(in srgb, var(--care-primary) 12%, transparent);
  color: var(--care-primary);
}
</style>
