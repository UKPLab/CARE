<template>
  <div class="btn-group gap-2 flex-wrap">
    <BasicButton
        class="btn-secondary btn-sm"
        :title="$t('users.liveSessions')"
        :text="$t('users.liveSessions')"
        icon="people-fill"
        @click="$emit('live-sessions')"
    />
    <BasicButton
        class="btn-secondary btn-sm"
        :title="$t('users.downloadUsers')"
        :text="$t('users.downloadUsers')"
        icon="download"
        @click="downloadUsers"
    />
    <BasicButton
        class="btn-secondary btn-sm"
        :title="$t('users.rights.managementTitle')"
        :text="$t('users.rights.managementTitle')"
        icon="shield-lock"
        @click="$emit('rights-management')"
    />
    <BasicButton
      class="btn-secondary btn-sm"
      :title="$t('users.roleManagement.button')"
      :text="$t('users.roleManagement.button')"
      icon="person-plus"
      @click="$emit('role-management')"
    />
    <BasicButton
        class="btn-secondary btn-sm"
        :title="$t('users.uploadPassword')"
        :text="$t('users.uploadPassword')"
        icon="key"
        @click="$emit('upload-passwords')"
    />
    <BasicButton
        class="btn-secondary btn-sm"
        :title="$t('users.importCsv')"
        :text="$t('users.importCsv')"
        icon="filetype-csv"
        @click="$emit('import', 'csv')"
    />
    <BasicButton
        class="btn-secondary btn-sm"
        :title="$t('users.importViaMoodle')"
        :text="$t('users.importViaMoodle')"
        icon="box-arrow-in-down"
        @click="$emit('import', 'moodle')"
    />
    <BasicButton
        class="btn-primary btn-sm"
        :title="$t('users.addUser')"
        :text="$t('users.addUser')"
        icon="person-plus"
        @click="$emit('add-user')"
    />
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import {downloadObjectsAs, formatLocalizedDate} from "@/assets/utils";

/**
 * Header actions of the users dashboard. Downloads the user list as CSV
 * itself; every other action is emitted for the page to open its modal.
 * The page subscribes to the user table.
 */
export default {
  name: "UsersToolbar",
  components: { BasicButton },
  emits: ["live-sessions", "rights-management", "role-management", "upload-passwords", "import", "add-user"],
  computed: {
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
