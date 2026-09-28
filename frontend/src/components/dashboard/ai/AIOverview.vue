<template>
  <BasicModal ref="overviewModal" :name="modalName" size="lg">
    <template #title>
      {{ $t(config.titleKey) }}
    </template>
    <template #body>
      <BasicDetails v-if="meta && row" :items="detailRows">
        <pre
          v-if="meta.isOwner && additionalParametersJson"
          class="bg-light border rounded p-2 small text-break mb-3"
        >{{ additionalParametersJson }}</pre>

        <div v-if="meta.viewerShare" class="alert alert-info py-2 small mb-3">
          {{ $t("ai.overview.sharedAccessExpires", { date: formatDateTime(meta.viewerShare.expiryDate) }) }}
        </div>

        <template v-if="meta.isOwner">
          <h6 class="text-muted text-uppercase small mb-2">
            {{ $t("ai.overview.sharedWithActive") }}
          </h6>
          <BasicTable
            :columns="shareColumns"
            :data="shareRows"
            :options="shareTableOptions"
            :max-table-height="300"
          />
        </template>
      </BasicDetails>
    </template>
    <template #footer>
      <BasicButton
        :title="$t('ai.common.close')"
        class="btn btn-secondary"
        @click="$refs.overviewModal.close()"
      />
    </template>
  </BasicModal>
</template>

<script>
/**
 * Modal overview differentiating organizers vs delegated viewers pulling server-side ACL metadata only.
 *
 * @author Akash Gundapuneni
 */

import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";
import BasicDetails from "@/basic/Details.vue";
import { formatLocalizedDateTime } from "@/assets/utils";

const RESOURCE_CONFIGS = {
  model: {
    titleKey: "ai.overview.modelTitle",
    modalName: "aiModelOverviewModal",
    shareTable: "ai_model_share",
    idKey: "aiModelId",
    invalidMessageKey: "ai.errors.invalidModel",
    details(row, meta, helpers) {
      return [
        { key: "name", label: helpers.t("ai.common.name"), value: row.name },
        { key: "provider", label: helpers.t("ai.common.provider"), value: row.provider },
        { key: "model", label: helpers.t("ai.models.modelId"), value: row.model, type: "code" },
        {
          key: "status",
          label: helpers.t("ai.common.status"),
          value: row.enabled ? helpers.t("ai.status.enabled") : helpers.t("ai.status.disabled"),
          type: "badge",
          class: row.enabled ? "bg-success" : "bg-secondary",
        },
        { key: "credential", label: helpers.t("ai.common.credential"), value: row.credentialName, visible: meta.isOwner && !!row.credentialName },
        { key: "updated", label: helpers.t("ai.common.updated"), value: helpers.formatDateTime(row.updatedAt) },
        { key: "description", label: helpers.t("ai.common.description"), value: row.description, visible: !!row.description },
      ];
    },
  },
  hook: {
    titleKey: "ai.overview.hookTitle",
    modalName: "aiHookOverviewModal",
    shareTable: "ai_hook_share",
    idKey: "aiHookId",
    invalidMessageKey: "ai.errors.invalidHook",
    details(row, _meta, helpers) {
      return [
        { key: "name", label: helpers.t("ai.common.name"), value: row.name },
        { key: "description", label: helpers.t("ai.common.description"), value: row.description },
        { key: "template", label: helpers.t("ai.hooks.promptTemplate"), value: row.templateName },
        { key: "models", label: helpers.t("ai.common.models"), value: (row.models || []).map((model) => model.name), type: "list" },
        { key: "output", label: helpers.t("ai.hooks.outputType"), value: row.outputLabel },
        { key: "status", label: helpers.t("ai.common.status"), value: row.statusLabel },
        { key: "created", label: helpers.t("ai.common.created"), value: helpers.formatDateTime(row.createdAt) },
        { key: "updated", label: helpers.t("ai.common.updated"), value: helpers.formatDateTime(row.updatedAt) },
      ];
    },
  },
};

export default {
  name: "AIOverview",
  subscribeTable: ["ai_model_share", "ai_hook_share", "user", "user_role", "user_role_matching"],
  components: { BasicModal, BasicButton, BasicTable, BasicDetails },
  props: {
    resourceType: {
      type: String,
      default: "model",
      validator: (value) => Object.keys(RESOURCE_CONFIGS).includes(value),
    },
  },
  data() {
    return {
      row: null,
      shareTableOptions: {
        striped: true,
        hover: true,
      },
    };
  },
  computed: {
    shareColumns() {
      return [
        { name: this.$t("ai.common.name"), key: "recipientLabel", sortable: true },
        { name: this.$t("ai.overview.access"), key: "accessLabel", sortable: true },
        { name: this.$t("ai.overview.expires"), key: "expiryLabel", sortable: true },
      ];
    },
    config() {
      return RESOURCE_CONFIGS[this.resourceType] || RESOURCE_CONFIGS.model;
    },
    modalName() {
      return this.config.modalName;
    },
    currentUserId() {
      return Number(this.$store.getters["auth/getUserId"]);
    },
    meta() {
      if (!this.row) return null;

      const now = new Date();
      const idKey = this.config.idKey;
      const getter = this.$store.getters[`table/${this.config.shareTable}/getFiltered`];
      const shares = getter
        ? getter((share) => Number(share[idKey]) === Number(this.row.id) && !share.deleted)
        : [];
      const isOwner = Number(this.row.userId) === this.currentUserId;

      if (isOwner) {
        const users = this.$store.getters["table/user/getAll"] || [];
        const userById = users.reduce((acc, user) => { acc[user.id] = user; return acc; }, {});
        const roles = this.$store.getters["table/user_role/getAll"] || [];
        const roleById = roles.reduce((acc, role) => { acc[role.id] = role; return acc; }, {});

        const shareRecipients = shares
          .filter((share) => new Date(share.expiryDate) > now)
          .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))
          .map((share) => {
            const isRole = !!share.roleId;
            const user = userById[share.userId];
            return {
              recipientLabel: isRole ? null : ([user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || null),
              accessVia: isRole ? "role" : "direct",
              viaLabel: isRole ? (roleById[share.roleId]?.name || null) : null,
              expiryDate: share.expiryDate,
            };
          });
        return { isOwner: true, viewerShare: null, shareRecipients };
      }

      const myRoleIds = (this.$store.getters["table/user_role_matching/getAll"] || [])
        .filter((match) => Number(match.userId) === this.currentUserId)
        .map((match) => Number(match.userRoleId));
      const viewerShareRow = shares.find((share) =>
        new Date(share.expiryDate) > now
        && (Number(share.userId) === this.currentUserId || (share.roleId && myRoleIds.includes(Number(share.roleId))))
      );
      return {
        isOwner: false,
        viewerShare: viewerShareRow ? { expiryDate: viewerShareRow.expiryDate } : null,
        shareRecipients: [],
      };
    },
    detailRows() {
      if (!this.row || !this.meta) return [];
      const helpers = { formatDateTime: this.formatDateTime, t: (key) => this.$t(key) };
      return this.config.details(this.row, this.meta, helpers)
        .filter((item) => item.visible !== false)
        .map((item) => ({
          ...item,
          value: this.normalizeDetailValue(item),
        }))
        .filter((item) => item.type === "list" || item.value !== "");
    },
    shareRows() {
      return (this.meta?.shareRecipients || []).map((recipient, index) => ({
        id: index + 1,
        recipientLabel: recipient.recipientLabel || "-",
        accessLabel: this.formatAccess(recipient),
        expiryLabel: this.formatDateTime(recipient.expiryDate),
      }));
    },
    additionalParametersJson() {
      const ap = this.resourceType === "model" ? this.row?.additionalParameters : null;
      if (!ap || typeof ap !== "object" || !Object.keys(ap).length) return "";
      try {
        return JSON.stringify(ap, null, 2);
      } catch (_error) {
        return "";
      }
    },
  },
  methods: {
    normalizeDetailValue(item) {
      if (item.type === "list") {
        return Array.isArray(item.value) ? item.value : [];
      }
      return item.value || "-";
    },
    formatAccess(row) {
      if (row.accessVia === "role") return row.viaLabel ? this.$t("ai.overview.roleNamed", { name: row.viaLabel }) : this.$t("ai.common.role");
      return this.$t("ai.common.user");
    },
    formatDateTime(value) {
      if (!value) return "-";
      return formatLocalizedDateTime(value) || "-";
    },
    open(row) {
      if (!row?.id) {
        this.eventBus.emit("toast", { title: this.$t("ai.common.error"), message: this.$t(this.config.invalidMessageKey), variant: "danger" });
        return;
      }
      this.row = row;
      this.$refs.overviewModal.open();
    },
  },
};
</script>
