<template>
  <BasicModal
    ref="modal"
    name="assessmentVersions"
    size="lg"
    @hide="$emit('closed')"
  >
    <template #title>
      {{ $t("assessmentManagement.versions.title", { name }) }}
    </template>
    <template #body>
      <div
        v-if="error"
        class="alert alert-danger d-flex justify-content-between align-items-center"
        role="alert"
      >
        <span>{{ error }}</span>
        <BasicButton
          class="btn btn-sm btn-outline-danger"
          icon="arrow-clockwise"
          :text="$t('assessmentManagement.actions.retry')"
          @click="load"
        />
      </div>
      <BasicLoading
        v-if="loading && versions.length === 0"
        class="py-3"
        :text="$t('assessmentManagement.messages.loading')"
      />
      <BasicTable
        v-else-if="versions.length > 0"
        :columns="columns"
        :data="versions"
        :options="tableOptions"
        :buttons="buttons"
        @action="onAction"
      />
      <p
        v-else-if="!error && !loading"
        class="text-center text-muted py-3 mb-0"
      >
        {{ $t("assessmentManagement.versions.empty") }}
      </p>
      <!-- modals nested in this one (e.g. the read-only view of a version) are given by the page -->
      <slot />
      <ConfirmModal ref="confirm" />
    </template>
    <template #footer>
      <span class="btn-group">
        <BasicButton
          class="btn btn-secondary"
          :title="$t('common.close')"
          @click="close"
        />
      </span>
    </template>
  </BasicModal>
</template>

<script>
/**
 * Versions modal shared by the Criteria, Rubrics and Assessments tabs: all live versions of one group, newest
 * first, with version number, name and creation date. Each row has View (the page opens its read-only modal, in
 * the `default` slot so it nests in this one) and Delete (confirmation first, one version only, the backend
 * refuses a version that is still referenced and says by whom). The row stays until the backend confirmed the
 * delete; then the list is reloaded and `changed` tells the page to refresh its main table (latest version and
 * count come from the backend).
 *
 * Events used: `<kind>GetVersions` with `<kind>GroupId` and `<kind>Delete` with `<kind>Id`.
 *
 * @author Eyad Mohamed
 */
import BasicButton from "@/basic/Button.vue";
import BasicLoading from "@/basic/Loading.vue";
import BasicModal from "@/basic/Modal.vue";
import BasicTable from "@/basic/Table.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import { dashboardRowAction } from "@/basic/dashboard/actions.js";
import { withSearch } from "@/basic/dashboard/constants.js";
import { failureText } from "@/components/dashboard/assessments/failureMessage.js";
import { requestAssessment } from "@/components/dashboard/assessments/assessmentSocket.js";
import { escapeHtml } from "@/components/dashboard/assessments/criterionForm.js";

const messageOf = (error, vm) => failureText(error, vm);

export default {
  name: "VersionsModal",
  components: { BasicButton, BasicLoading, BasicModal, BasicTable, ConfirmModal },
  props: {
    /** "criterion", "rubric" or "assessment": names the socket events and the id fields */
    kind: { type: String, required: true },
    /** i18n key of the singular noun used in the messages, e.g. "assessmentManagement.kinds.criterion" */
    kindLabel: { type: String, required: true },
  },
  emits: ["view", "changed", "closed"],
  data() {
    return {
      groupId: null,
      name: "",
      versions: [],
      loading: false,
      error: "",
      deleting: false,
      loadSeq: 0,
    };
  },
  computed: {
    columns() {
      return [
        { name: this.$t("assessmentManagement.fields.version"), key: "versionNumber", sortable: true },
        { name: this.$t("assessmentManagement.fields.name"), key: "name", sortable: true },
        { name: this.$t("assessmentManagement.fields.createdAt"), key: "createdAt", type: "datetime", sortable: true },
      ];
    },
    buttons() {
      return [
        dashboardRowAction("view", { title: this.$t("assessmentManagement.actions.view"), action: "view" }),
        dashboardRowAction("delete", {
          title: this.$t("assessmentManagement.actions.delete"),
          action: "delete",
          options: { iconOnly: true, specifiers: { "btn-outline-danger": true } },
        }),
      ];
    },
    /** Same table settings as the dashboard tables, with the search box (names and version numbers) */
    tableOptions() {
      return withSearch();
    },
    groupKey() {
      return `${this.kind}GroupId`;
    },
  },
  methods: {
    /**
     * Open the modal for one group and load its versions.
     *
     * @param {{groupId: number, name: string}} group - Group id and the name to show in the title
     */
    open({ groupId, name }) {
      this.groupId = groupId;
      this.name = name;
      this.versions = [];
      this.error = "";
      this.$refs.modal.open();
      return this.load();
    },
    close() {
      this.$refs.modal.close();
    },
    /** Load the versions; only the newest answer is applied. A failed reload keeps the shown rows. */
    async load() {
      const seq = ++this.loadSeq;
      this.loading = true;
      try {
        const versions = await requestAssessment(this.$socket, `${this.kind}GetVersions`, { [this.groupKey]: this.groupId });
        if (seq === this.loadSeq) {
          this.versions = versions;
          this.error = "";
        }
      } catch (error) {
        if (seq === this.loadSeq) {
          this.error = messageOf(error, this);
        }
      } finally {
        if (seq === this.loadSeq) {
          this.loading = false;
        }
      }
    },
    onAction({ action, params }) {
      if (action === "view") {
        this.$emit("view", params);
      } else if (action === "delete") {
        this.confirmDelete(params);
      }
    },
    /** Ask first; nothing is sent until the user confirmed. */
    confirmDelete(version) {
      if (this.deleting) {
        return;
      }
      this.$refs.confirm.open(
        this.$t("assessmentManagement.confirm.title"),
        this.$t("assessmentManagement.confirm.deleteVersion", {
          kind: this.$t(this.kindLabel),
          name: escapeHtml(version.name),
          version: escapeHtml(version.versionNumber),
        }),
        null,
        (confirmed) => {
          if (confirmed) {
            this.deleteVersion(version);
          }
        }
      );
    },
    async deleteVersion(version) {
      if (this.deleting) {
        return;
      }
      this.deleting = true;
      try {
        const deleted = await requestAssessment(this.$socket, `${this.kind}Delete`, { [`${this.kind}Id`]: version.id });
        this.eventBus.emit("toast", {
          title: this.$t("assessmentManagement.messages.deleted"),
          message: this.$t("assessmentManagement.messages.versionDeleted", {
            kind: this.$t(this.kindLabel),
            name: version.name,
            version: version.versionNumber,
          }),
          variant: "success",
        });
        if (deleted?.latestVersionId === null) {
          // the last version is gone: the group no longer exists (a reload would only answer "not found")
          this.versions = [];
          this.$emit("changed", { groupId: this.groupId, versions: [] });
          this.close();
          return;
        }
        await this.load();
        this.$emit("changed", { groupId: this.groupId, versions: this.versions });
      } catch (error) {
        // e.g. a rubric still uses the version: the backend message names the rubrics
        this.eventBus.emit("toast", {
          title: this.$t("assessmentManagement.messages.deleteFailed"),
          message: messageOf(error, this),
          variant: "danger",
        });
      } finally {
        this.deleting = false;
      }
    },
  },
};
</script>
