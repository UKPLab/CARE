<template>
  <BasicModal ref="overviewModal" :name="modalName" size="lg">
    <template #title>
      {{ config.title }}
    </template>
    <template #body>
      <template v-if="meta && row">
        <dl class="row mb-3 small">
          <template v-for="item in detailRows" :key="item.key">
            <dt class="col-sm-3">
              {{ item.label }}
            </dt>
            <dd class="col-sm-9 text-break">
              <span v-if="item.type === 'badge'" class="badge" :class="item.class">
                {{ item.value }}
              </span>
              <code v-else-if="item.type === 'code'">{{ item.value }}</code>
              <ol v-else-if="item.type === 'list'" class="mb-0 ps-3">
                <li v-for="(entry, index) in item.value" :key="`${item.key}-${index}`">
                  {{ entry }}
                </li>
              </ol>
              <span v-else>{{ item.value }}</span>
            </dd>
          </template>
        </dl>
        <pre
          v-if="meta.isOwner && additionalParametersJson"
          class="bg-light border rounded p-2 small text-break mb-3"
        >{{ additionalParametersJson }}</pre>

        <div v-if="meta.viewerShare" class="alert alert-info py-2 small mb-3">
          Shared access expires {{ formatDateTime(meta.viewerShare.expiryDate) }}.
        </div>

        <template v-if="meta.isOwner">
          <h6 class="text-muted text-uppercase small mb-2">
            Shared with (active)
          </h6>
          <BasicTable
            :columns="shareColumns"
            :data="shareRows"
            :options="shareTableOptions"
            :max-table-height="300"
          />
        </template>
      </template>
    </template>
    <template #footer>
      <BasicButton
        title="Close"
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

const RESOURCE_CONFIGS = {
  model: {
    title: "AI model overview",
    modalName: "aiModelOverviewModal",
    shareTable: "ai_model_share",
    idKey: "aiModelId",
    invalidMessage: "Invalid model",
    details(row, meta, helpers) {
      return [
        { key: "name", label: "Name", value: row.name },
        { key: "provider", label: "Provider", value: row.provider },
        { key: "model", label: "Model ID", value: row.model, type: "code" },
        {
          key: "status",
          label: "Status",
          value: row.enabled ? "Enabled" : "Disabled",
          type: "badge",
          class: row.enabled ? "bg-success" : "bg-secondary",
        },
        { key: "credential", label: "Credential", value: row.credentialName, visible: meta.isOwner && !!row.credentialName },
        { key: "updated", label: "Updated", value: helpers.formatDateTime(row.updatedAt) },
        { key: "description", label: "Description", value: row.description, visible: !!row.description },
      ];
    },
  },
  hook: {
    title: "AI hook overview",
    modalName: "aiHookOverviewModal",
    shareTable: "ai_hook_share",
    idKey: "aiHookId",
    invalidMessage: "Invalid AI hook",
    details(row, _meta, helpers) {
      return [
        { key: "name", label: "Name", value: row.name },
        { key: "description", label: "Description", value: row.description },
        { key: "template", label: "Prompt Template", value: row.templateName },
        { key: "models", label: "Models", value: (row.models || []).map((model) => model.name), type: "list" },
        { key: "output", label: "Output Type", value: row.outputLabel },
        { key: "status", label: "Status", value: row.statusLabel },
        { key: "created", label: "Created", value: helpers.formatDateTime(row.createdAt) },
        { key: "updated", label: "Updated", value: helpers.formatDateTime(row.updatedAt) },
      ];
    },
  },
};

export default {
  name: "AIOverview",
  subscribeTable: ["ai_model_share", "ai_hook_share", "user", "user_role", "user_role_matching"],
  components: { BasicModal, BasicButton, BasicTable },
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
      shareColumns: [
        { name: "Name", key: "recipientLabel", sortable: true },
        { name: "Access", key: "accessLabel", sortable: true },
        { name: "Expires", key: "expiryLabel", sortable: true },
      ],
    };
  },
  computed: {
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
      const helpers = { formatDateTime: this.formatDateTime };
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
        return Array.isArray(item.value) && item.value.length > 0 ? item.value : ["-"];
      }
      return item.value || "-";
    },
    formatAccess(row) {
      if (row.accessVia === "role") return row.viaLabel ? `Role: ${row.viaLabel}` : "Role";
      return "User";
    },
    formatDateTime(value) {
      if (!value) return "-";
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
    },
    open(row) {
      if (!row?.id) {
        this.eventBus.emit("toast", { title: "Error", message: this.config.invalidMessage, variant: "danger" });
        return;
      }
      this.row = row;
      this.$refs.overviewModal.open();
    },
  },
};
</script>
