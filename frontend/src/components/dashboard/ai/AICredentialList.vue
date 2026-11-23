<template>
  <div>
    <DashboardListPage
      :title="$t('ai.models.credentialsTitle')"
      :empty-action="emptyCredentialAction"
      :columns="credentialColumns"
      :data="credentialRows"
      :buttons="credentialButtons"
      @action="onCredentialAction"
    >
      <template #headerActions>
        <BasicButton
          class="btn-primary btn-sm"
          :title="$t('ai.models.addCredentialTitle')"
          icon="plus"
          :text="$t('ai.models.addCredential')"
          @click="openCredentialModal()"
        />
      </template>
    </DashboardListPage>

    <AICredential ref="aiCredential" />
    <ConfirmModal ref="confirmModal" />
  </div>
</template>

<script>
/**
 * Credentials section of the AI models dashboard: lists the user's API
 * credentials and handles creating, editing, enabling/disabling and deleting them.
 *
 * @author Akash Gundapuneni
 */
import DashboardListPage from "@/basic/dashboard/ListPage.vue";
import BasicButton from "@/basic/Button.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import AICredential from "@/components/dashboard/ai/AICredential.vue";
import { resolveApiMessage } from "@/assets/utils";
import { dashboardRowAction, dashboardRowButton } from "@/basic/dashboard/actions.js";

export default {
  name: "AICredentialList",
  components: {
    DashboardListPage,
    BasicButton,
    ConfirmModal,
    AICredential,
  },
  computed: {
    /** Same as the header create button; offered while the table is empty. */
    emptyCredentialAction() {
      return {
        label: this.$t("ai.models.addCredential"),
        icon: "plus-lg",
        handler: () => this.openCredentialModal(),
      };
    },
    credentialColumns() {
      return [
        { name: this.$t("ai.common.name"), key: "name", sortable: true },
        { name: this.$t("ai.common.provider"), key: "provider", sortable: true },
        { name: this.$t("ai.models.baseUrl"), key: "apiBaseUrl", sortable: true },
        { name: this.$t("ai.models.version"), key: "apiVersion", sortable: true },
        { name: this.$t("ai.common.models"), key: "modelCount", type: "badge" },
        { name: this.$t("ai.common.status"), key: "status", type: "badge" },
        { name: this.$t("ai.common.created"), key: "createdAt", type: "datetime", sortable: true },
      ];
    },
    credentials() {
      return this.$store.getters["table/ai_credential/getAll"] || [];
    },
    models() {
      return this.$store.getters["table/ai_model/getAll"] || [];
    },
    credentialRows() {
      return this.credentials.map((credential) => ({
        ...credential,
        status: {
          text: credential.enabled ? this.$t("ai.status.enabled") : this.$t("ai.status.disabled"),
          class: credential.enabled ? "bg-success" : "bg-secondary",
        },
        modelCount: {
          text: String(this.models.filter((m) => m.aiCredentialId === credential.id).length),
          class: "bg-primary",
        },
      }));
    },
    credentialButtons() {
      return [
        dashboardRowAction("edit", {
          title: this.$t("ai.actions.editCredential"),
          action: "editCredential",
        }),
        dashboardRowButton("toggle2-on", {
          title: this.$t("ai.actions.disableCredential"),
          action: "toggleCredential",
          filter: [{ key: "enabled", value: true }],
        }),
        dashboardRowButton("toggle2-off", {
          title: this.$t("ai.actions.enableCredential"),
          action: "toggleCredential",
          filter: [{ key: "enabled", value: false }],
        }, "warning"),
        dashboardRowAction("delete", {
          title: this.$t("ai.actions.deleteCredential"),
          action: "deleteCredential",
        }),
      ];
    },
  },
  methods: {
    onCredentialAction(data) {
      switch (data.action) {
        case "editCredential":
          this.openCredentialModal(data.params);
          break;
        case "toggleCredential":
          this.toggleCredential(data.params);
          break;
        case "deleteCredential":
          this.deleteCredential(data.params);
          break;
      }
    },
    openCredentialModal(row = null) {
      this.$refs.aiCredential.open(row);
    },
    toggleCredential(row) {
      this.$socket.emit("appDataUpdate", {
        table: "ai_credential",
        data: {
          id: row.id,
          enabled: !row.enabled,
        },
      }, (result) => {
        if (!result.success) {
          this.toastError(resolveApiMessage(result, "ai.errors.updateCredential"));
        }
      });
    },
    deleteCredential(row) {
      this.$refs.confirmModal.open(
        this.$t("ai.confirm.deleteCredentialTitle"),
        this.$t("ai.confirm.deleteCredential", { name: row.name }),
        "",
        (confirmed) => {
          if (!confirmed) return;
          this.$socket.emit("appDataUpdate", {
            table: "ai_credential",
            data: {
              id: row.id,
              deleted: true,
            },
          }, (result) => {
            if (result.success) {
              this.toastSuccess(this.$t("ai.messages.credentialDeleted"));
            } else {
              this.toastError(resolveApiMessage(result, "ai.errors.deleteCredential"));
            }
          });
        }
      );
    },
    toastSuccess(message) {
      this.eventBus.emit("toast", {
        title: this.$t("ai.common.success"),
        message,
        variant: "success",
      });
    },
    toastError(message) {
      this.eventBus.emit("toast", {
        title: this.$t("ai.common.error"),
        message,
        variant: "danger",
      });
    },
  },
};
</script>
