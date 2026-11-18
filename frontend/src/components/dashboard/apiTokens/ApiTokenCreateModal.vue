<template>
  <Modal
    ref="modal"
    name="apiTokenCreate"
    size="lg"
    :disable-keyboard="secretUnhandled"
    @close-requested="onCloseRequested"
  >
    <template #title>
      {{ $t('dashboard.apiTokens.createTitle') }}
    </template>
    <template #body>
      <template v-if="createdSecret">
        <div
          class="alert alert-warning"
          role="alert"
        >
          {{ $t('dashboard.apiTokens.secretOnceWarning') }}
        </div>
        <label
          class="form-label"
          for="apiTokenSecret"
        >
          {{ $t('dashboard.apiTokens.secretLabel') }}
        </label>
        <div class="input-group">
          <input
            id="apiTokenSecret"
            class="form-control font-monospace"
            readonly
            :type="secretVisible ? 'text' : 'password'"
            :value="createdSecret"
          >
          <BasicButton
            class="btn-outline-secondary"
            :icon="secretVisible ? 'eye-slash-fill' : 'eye-fill'"
            text=""
            :title="secretVisible ? $t('dashboard.apiTokens.hideSecret') : $t('dashboard.apiTokens.showSecret')"
            :aria-label="secretVisible ? $t('dashboard.apiTokens.hideSecret') : $t('dashboard.apiTokens.showSecret')"
            @click="toggleSecret"
          />
          <BasicButton
            class="btn-outline-secondary"
            icon="clipboard"
            text=""
            :title="$t('dashboard.apiTokens.copySecret')"
            :aria-label="$t('dashboard.apiTokens.copySecret')"
            @click="copySecret"
          />
        </div>
      </template>
      <template v-else>
        <label
          class="form-label"
          for="apiTokenName"
        >
          {{ $t('dashboard.apiTokens.nameLabel') }}
        </label>
        <input
          id="apiTokenName"
          v-model="name"
          class="form-control"
          type="text"
        >
        <div class="mt-3">
          <label
            class="form-label mb-0"
            for="apiTokenExpiry"
          >
            {{ $t('dashboard.apiTokens.expiryLabel') }}
          </label>
          <p class="text-muted small mb-2">
            {{ $t('dashboard.apiTokens.expiryHelp') }}
          </p>
          <select
            id="apiTokenExpiry"
            v-model.number="expiryDays"
            class="form-select form-select-sm w-auto"
          >
            <option
              v-for="option in expiryOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.name }}
            </option>
          </select>
        </div>
        <div class="mt-3">
          <span class="form-label d-block mb-0">
            {{ $t('dashboard.apiTokens.rightsLabel') }}
          </span>
          <p class="text-muted small mb-2">
            {{ $t('dashboard.apiTokens.rightsHelp') }}
          </p>
          <div class="d-flex align-items-center gap-2 mb-2">
            <label
              class="form-label mb-0 text-nowrap"
              for="apiTokenPreset"
            >
              {{ $t('dashboard.apiTokens.presetLabel') }}
            </label>
            <select
              id="apiTokenPreset"
              v-model="preset"
              class="form-select form-select-sm w-auto"
              @change="applyPreset"
            >
              <option
                v-for="option in presetOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.name }}
              </option>
            </select>
            <span class="text-muted small ms-auto">
              {{ $t('dashboard.apiTokens.rightsSelected', {count: selectedRights.length, total: availableRights.length}) }}
            </span>
          </div>
          <BasicTable
            v-model="selectedRights"
            :columns="rightsColumns"
            :data="availableRights"
            :options="rightsTableOptions"
            :max-table-height="'40vh'"
          />
        </div>
      </template>
    </template>
    <template #footer>
      <div class="btn-group gap-2">
        <BasicButton
          v-if="!createdSecret"
          class="btn-primary btn-sm"
          :text="$t('common.create')"
          :title="canCreate ? '' : $t('dashboard.apiTokens.rightsRequired')"
          icon="plus"
          :disabled="creating || !canCreate"
          @click="createToken"
        />
        <BasicButton
          class="btn-outline-secondary btn-sm"
          :text="$t('common.close')"
          @click="requestClose"
        />
      </div>
    </template>
  </Modal>
  <ConfirmModal ref="closeConfirm" />
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import Modal from "@/basic/Modal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";
import {resolveApiMessage} from "@/assets/utils";

/**
 * Create an API token: name it, tick the rights it may use, then copy the secret once.
 * A new token starts with nothing ticked. Presets tick "all my rights" or one role's rights.
 * The secret starts hidden; the eye button shows it and the clipboard button copies it without showing
 * it. Closing before either asks once, because the secret cannot be shown again.
 *
 * @emits created after a token was created, so the list can reload
 */
export default {
  name: "ApiTokenCreateModal",
  components: {BasicTable, BasicButton, Modal, ConfirmModal},
  emits: ["created"],
  data() {
    return {
      name: "",
      createdSecret: "",
      secretVisible: false,
      secretHandled: false,
      creating: false,
      availableRights: [],
      rolePresets: [],
      selectedRights: [],
      preset: "none",
      expiryDays: 90,
      rightsTableOptions: {
        striped: true,
        hover: true,
        small: true,
        pagination: 10,
        search: true,
        selectableRows: true,
      },
    };
  },
  computed: {
    rightsColumns() {
      return [
        {key: "name", name: this.$t("dashboard.apiTokens.rightName"), sortable: true},
        {key: "description", name: this.$t("dashboard.apiTokens.rightDescription")},
      ];
    },
    presetOptions() {
      return [
        {value: "none", name: this.$t("dashboard.apiTokens.presetNone")},
        {value: "all", name: this.$t("dashboard.apiTokens.presetAll")},
        ...this.rolePresets.map((role) => ({
          value: "role:" + role.id,
          name: this.$t("dashboard.apiTokens.presetRole", {
            role: this.$te(`users.roles.${role.name}`) ? this.$t(`users.roles.${role.name}`) : role.name,
          }),
        })),
      ];
    },
    expiryOptions() {
      return [
        ...[30, 90, 365].map((days) => ({value: days, name: this.$t("dashboard.apiTokens.expiryDays", {days})})),
        {value: 0, name: this.$t("dashboard.apiTokens.expiryNever")},
      ];
    },
    secretUnhandled() {
      return this.createdSecret !== "" && !this.secretHandled;
    },
    canCreate() {
      return this.name.trim() !== "" && this.selectedRights.length > 0;
    },
  },
  methods: {
    open() {
      this.name = "";
      this.createdSecret = "";
      this.secretVisible = false;
      this.secretHandled = false;
      // Least privilege: a new token starts with nothing ticked.
      this.preset = "none";
      this.selectedRights = [];
      this.expiryDays = 90;
      this.$refs.modal.open();
      this.loadRightChoices();
    },
    close() {
      this.createdSecret = "";
      this.secretVisible = false;
      this.$refs.modal.close();
    },
    toggleSecret() {
      this.secretVisible = !this.secretVisible;
      this.secretHandled = true;
    },
    /**
     * Close, but ask once first if the secret was neither copied nor shown.
     */
    requestClose() {
      if (!this.secretUnhandled) {
        this.close();
        return;
      }
      this.$refs.closeConfirm.open(
        this.$t("dashboard.apiTokens.closeWithoutCopyTitle"),
        this.$t("dashboard.apiTokens.closeWithoutCopyMessage"),
        null,
        (ok) => {
          if (ok) {
            this.close();
          }
        }
      );
    },
    onCloseRequested() {
      // The header X goes through the same check as the Close button.
      if (this.secretUnhandled) {
        this.$refs.modal.markCloseRequestHandled();
        this.requestClose();
      }
    },
    async loadRightChoices() {
      try {
        const response = await axios.get(getServerURL() + "/auth/api-tokens/rights", {
          withCredentials: true,
        });
        this.availableRights = response.data.rights || [];
        this.rolePresets = response.data.roles || [];
      } catch (error) {
        this.eventBus.emit("toast", {
          title: this.$t("dashboard.apiTokens.toasts.rightsLoadFailed"),
          message: resolveApiMessage(error.response && error.response.data),
          variant: "danger",
        });
      }
    },
    applyPreset() {
      let names = [];
      if (this.preset === "all") {
        names = this.availableRights.map((right) => right.name);
      } else if (this.preset.startsWith("role:")) {
        const role = this.rolePresets.find((item) => "role:" + item.id === this.preset);
        names = role ? role.rights : [];
      }
      // Rows must be the same objects the table shows, so the checkboxes follow.
      this.selectedRights = this.availableRights.filter((right) => names.includes(right.name));
    },
    async createToken() {
      this.creating = true;
      try {
        const response = await axios.post(
          getServerURL() + "/auth/api-tokens",
          {
            name: this.name,
            rights: this.selectedRights.map((right) => right.name),
            expiresAt: this.expiryDays > 0
              ? new Date(Date.now() + this.expiryDays * 24 * 60 * 60 * 1000).toISOString()
              : null,
          },
          {withCredentials: true}
        );
        this.createdSecret = response.data.secret;
        this.$emit("created");
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
        this.secretHandled = true;
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
  },
};
</script>
