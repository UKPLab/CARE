<template>
  <NotFoundPage v-if="!featureEnabled"/>
  <template v-else>
    <DashboardListPage
      :title="$t('dashboard.apiTokens.title')"
      :columns="columns"
      :data="tokens"
      :buttons="buttons"
      @action="onAction"
    >
      <template #headerActions>
        <div class="btn-group gap-2">
          <BasicButton
            class="btn-primary btn-sm"
            :text="$t('common.create')"
            :title="$t('dashboard.apiTokens.createTooltip')"
            icon="plus"
            @click="$refs.createModal.open()"
          />
        </div>
      </template>
    </DashboardListPage>
    <ApiTokenCreateModal
      ref="createModal"
      @created="loadTokens"
    />
    <ConfirmModal ref="revokeConfirm"/>
  </template>
</template>

<script>
import DashboardListPage from "@/basic/dashboard/ListPage.vue";
import BasicButton from "@/basic/Button.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import NotFoundPage from "@/auth/NotFound.vue";
import ApiTokenCreateModal from "./apiTokens/ApiTokenCreateModal.vue";
import {dashboardRowAction} from "@/basic/dashboard/actions.js";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";
import {resolveApiMessage} from "@/assets/utils";

/**
 * Personal API tokens. List/create/revoke use cookie HTTP, not sockets.
 */
export default {
  name: "DashboardApiTokens",
  components: {DashboardListPage, BasicButton, ConfirmModal, NotFoundPage, ApiTokenCreateModal},
  data() {
    return {
      tokens: [],
    };
  },
  computed: {
    featureEnabled() {
      const value = this.$store.getters["settings/getValue"]("system.auth.apiTokens.enabled");
      return value === true || value === "true";
    },
    isAdmin() {
      return this.$store.getters["auth/isAdmin"];
    },
    columns() {
      const cols = [
        {key: "name", name: this.$t("dashboard.apiTokens.columns.name")},
        {key: "prefix", name: this.$t("dashboard.apiTokens.columns.prefix")},
        {key: "rightsCount", name: this.$t("dashboard.apiTokens.columns.rights")},
        {key: "createdAt", name: this.$t("dashboard.apiTokens.columns.createdAt")},
        {key: "lastUsedAt", name: this.$t("dashboard.apiTokens.columns.lastUsedAt")},
        {key: "expiresAt", name: this.$t("dashboard.apiTokens.columns.expiresAt")},
      ];
      if (this.isAdmin) {
        cols.splice(1, 0, {key: "userId", name: this.$t("dashboard.apiTokens.columns.userId")});
      }
      return cols;
    },
    buttons() {
      return [
        dashboardRowAction("delete", {
          title: this.$t("dashboard.apiTokens.revoke"),
          action: "revoke",
        }),
      ];
    },
  },
  watch: {
    featureEnabled(enabled) {
      if (enabled) {
        this.loadTokens();
      } else {
        this.tokens = [];
      }
    },
  },
  mounted() {
    if (this.featureEnabled) {
      this.loadTokens();
    }
  },
  methods: {
    async loadTokens() {
      try {
        const response = await axios.get(getServerURL() + "/auth/api-tokens", {
          withCredentials: true,
        });
        this.tokens = (response.data.tokens || []).map((token) => ({
          ...token,
          rightsCount: (token.rights || []).length,
          expiresAt: token.expiresAt || this.$t("dashboard.apiTokens.expiryNever"),
        }));
      } catch (error) {
        this.eventBus.emit("toast", {
          title: this.$t("dashboard.apiTokens.toasts.loadFailed"),
          message: resolveApiMessage(error.response && error.response.data),
          variant: "danger",
        });
      }
    },
    onAction(data) {
      if (data.action !== "revoke") {
        return;
      }
      const row = data.params;
      this.$refs.revokeConfirm.open(
        this.$t("dashboard.apiTokens.revoke"),
        this.$t("dashboard.apiTokens.revokeConfirm", {name: row.name}),
        null,
        async (ok) => {
          if (!ok) {
            return;
          }
          try {
            await axios.delete(getServerURL() + "/auth/api-tokens/" + row.id, {
              withCredentials: true,
            });
            await this.loadTokens();
          } catch (error) {
            this.eventBus.emit("toast", {
              title: this.$t("dashboard.apiTokens.toasts.revokeFailed"),
              message: resolveApiMessage(error.response && error.response.data),
              variant: "danger",
            });
          }
        }
      );
    },
  },
};
</script>
