<template>
  <NotFoundPage v-if="!featureEnabled"/>
  <template v-else>
    <Card :title="$t('dashboard.apiTokens.title')">
      <template #headerElements>
        <BasicButton
          class="btn-primary btn-sm"
          :text="$t('common.create')"
          :title="$t('dashboard.apiTokens.createTooltip')"
          icon="plus"
          @click="openCreate"
        />
      </template>
      <template #body>
        <p class="text-muted">
          {{ $t('dashboard.apiTokens.description') }}
        </p>
        <BasicTable
          :columns="columns"
          :data="tokens"
          :options="tableOptions"
          :buttons="buttons"
          :max-table-height="'65vh'"
          @action="onAction"
        />
      </template>
    </Card>

  <Modal ref="createModal">
    <template #title>
      {{ $t('dashboard.apiTokens.createTitle') }}
    </template>
    <template #body>
      <div
        v-if="createdSecret"
        class="alert alert-warning"
        role="alert"
      >
        {{ $t('dashboard.apiTokens.secretOnceWarning') }}
      </div>
      <label
        v-if="!createdSecret"
        class="form-label"
        for="apiTokenName"
      >
        {{ $t('dashboard.apiTokens.nameLabel') }}
      </label>
      <input
        v-if="!createdSecret"
        id="apiTokenName"
        v-model="newName"
        class="form-control"
        type="text"
      >
      <label
        v-if="createdSecret"
        class="form-label"
        for="apiTokenSecret"
      >
        {{ $t('dashboard.apiTokens.secretLabel') }}
      </label>
      <textarea
        v-if="createdSecret"
        id="apiTokenSecret"
        class="form-control font-monospace"
        readonly
        rows="3"
        :value="createdSecret"
      />
    </template>
    <template #footer>
      <BasicButton
        v-if="createdSecret"
        class="btn-secondary btn-sm"
        :text="$t('common.copy')"
        icon="clipboard"
        @click="copySecret"
      />
      <BasicButton
        v-if="!createdSecret"
        class="btn-primary btn-sm"
        :text="$t('common.create')"
        icon="plus"
        :disabled="creating"
        @click="createToken"
      />
      <BasicButton
        class="btn-outline-secondary btn-sm"
        :text="$t('common.close')"
        @click="closeCreate"
      />
    </template>
  </Modal>

  <ConfirmModal ref="revokeConfirm"/>
  </template>
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import Modal from "@/basic/Modal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import NotFoundPage from "@/auth/NotFound.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";
import {resolveApiMessage} from "@/assets/utils";

/**
 * Personal API tokens. List/create/revoke use cookie HTTP, not sockets.
 */
export default {
  name: "DashboardApiTokens",
  components: {Card, BasicTable, BasicButton, Modal, ConfirmModal, NotFoundPage},
  data() {
    return {
      tokens: [],
      newName: "",
      createdSecret: "",
      creating: false,
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
      },
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
        {key: "createdAt", name: this.$t("dashboard.apiTokens.columns.createdAt")},
        {key: "lastUsedAt", name: this.$t("dashboard.apiTokens.columns.lastUsedAt")},
      ];
      if (this.isAdmin) {
        cols.splice(1, 0, {key: "userId", name: this.$t("dashboard.apiTokens.columns.userId")});
      }
      return cols;
    },
    buttons() {
      return [
        {
          icon: "trash",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-danger": true,
            },
          },
          title: this.$t("dashboard.apiTokens.revoke"),
          action: "revoke",
        },
      ];
    },
  },
  mounted() {
    if (this.featureEnabled) {
      this.loadTokens();
    }
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
  methods: {
    async loadTokens() {
      try {
        const response = await axios.get(getServerURL() + "/auth/api-tokens", {
          withCredentials: true,
        });
        this.tokens = response.data.tokens || [];
      } catch (error) {
        this.eventBus.emit("toast", {
          title: this.$t("dashboard.apiTokens.toasts.loadFailed"),
          message: resolveApiMessage(error.response && error.response.data),
          variant: "danger",
        });
      }
    },
    openCreate() {
      this.newName = "";
      this.createdSecret = "";
      this.$refs.createModal.open();
    },
    closeCreate() {
      this.createdSecret = "";
      this.$refs.createModal.close();
    },
    async createToken() {
      this.creating = true;
      try {
        const response = await axios.post(
          getServerURL() + "/auth/api-tokens",
          {name: this.newName},
          {withCredentials: true}
        );
        this.createdSecret = response.data.secret;
        await this.loadTokens();
      } catch (error) {
        this.eventBus.emit("toast", {
          title: this.$t("dashboard.apiTokens.toasts.createFailed"),
          message: resolveApiMessage(error.response && error.response.data),
          variant: "danger",
        });
      } finally {
        this.creating = false;
      }
    },
    async copySecret() {
      try {
        await navigator.clipboard.writeText(this.createdSecret);
        this.eventBus.emit("toast", {
          title: this.$t("dashboard.apiTokens.toasts.copied"),
          variant: "success",
        });
      } catch (_error) {
        this.eventBus.emit("toast", {
          title: this.$t("dashboard.apiTokens.toasts.copyFailed"),
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
