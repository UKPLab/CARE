<template>
  <HeaderActions :actions="headerActions">
    <BasicButton
        class="btn-primary btn-sm"
        :title="$t('users.addUser')"
        :text="$t('users.addUser')"
        icon="person-plus"
        @click="$emit('add-user')"
    />
  </HeaderActions>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import HeaderActions from "@/basic/dashboard/HeaderActions.vue";
import {downloadObjectsAs, formatLocalizedDate} from "@/assets/utils";

/**
 * Header actions of the users dashboard. Downloads the user list as CSV
 * itself; every other action is emitted for the page to open its modal.
 * The page subscribes to the user table.
 */
export default {
  name: "UsersToolbar",
  components: { BasicButton, HeaderActions },
  emits: ["live-sessions", "rights-management", "role-management", "upload-passwords", "import", "add-user"],
  computed: {
    /** Secondary header buttons; collapse into "..." when the header is too narrow. */
    headerActions() {
      return [
        {key: "liveSessions", text: this.$t('users.liveSessions'), icon: "people-fill", onClick: () => this.$emit('live-sessions')},
        {key: "downloadUsers", text: this.$t('users.downloadUsers'), icon: "download", onClick: () => this.downloadUsers()},
        {key: "rightsManagement", text: this.$t('users.rights.managementTitle'), icon: "shield-lock", onClick: () => this.$emit('rights-management')},
        {key: "roleManagement", text: this.$t('users.roleManagement.button'), icon: "person-plus", onClick: () => this.$emit('role-management')},
        {key: "uploadPassword", text: this.$t('users.uploadPassword'), icon: "key", onClick: () => this.$emit('upload-passwords')},
        {key: "importCsv", text: this.$t('users.importCsv'), icon: "filetype-csv", onClick: () => this.$emit('import', 'csv')},
        {key: "importMoodle", text: this.$t('users.importViaMoodle'), icon: "box-arrow-in-down", onClick: () => this.$emit('import', 'moodle')},
      ];
    },
    systemRoles() {
      return this.$store.getters["admin/getSystemRoles"];
    },
    usersExport() {
      return this.$store.getters["table/user/getAll"].filter(user => !user.deleted).map((user) => {
        return {
          ID: user.id,
          "First Name": user.firstName,
          "Last Name": user.lastName,
          User: user.userName,
          Email: user.email,
          "Accept Terms": user.acceptTerms,
          "Accept Stats": user.acceptStats,
          "Accept Data Sharing": user.acceptDataSharing,
          "Accept Date": user.acceptedAt,
          "Last Login": user.lastLoginAt ? formatLocalizedDate(user.lastLoginAt) : "-",
          "Created": user.createdAt,
          "External ID": user.extId,
          "Verified": user.emailVerified,
          "Roles": user.roles.map(role => this.systemRoles.find((r) => r.id === role)?.name).join(", "),
        };
      });
    },
  },
  methods: {
    downloadUsers() {
      const filename = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '_users';
      downloadObjectsAs(this.usersExport, filename, "csv");
    },
  },
};
</script>
