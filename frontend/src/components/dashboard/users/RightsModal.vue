<template>
  <BasicModal ref="modal" name="RightsModal">
    <template #title>
      <slot name="title">
        <span>{{$t('dashboard.users.viewUserRight')}}</span>
      </slot>
    </template>
    <template #body>
      <div class="table-container">
        <!-- Check if it is an empty object. -->
        <template v-if="Object.keys(userRight).length === 0">
          <p>{{$t('dashboard.users.userHasNoAssignedRights')}}</p>
        </template>
        <template v-else>
          <BasicTable
            class="w-100"
            :columns="rightColumns"
            :data="rightRows"
            :options="{ bordered: true }"
          />
        </template>
      </div>
    </template>
    <template #footer>
      <span class="btn-group">
        <BasicButton
          :title="$t('dashboard.users.okay')"
          class="btn btn-primary"
          @click="$refs.modal.close()"
        />
      </span>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import { resolveApiMessage } from "@/assets/utils";
import BasicTable from "@/basic/Table.vue";

/**
 * Modal for viewing the rights the user has on this platform
 * @author: Linyin Huang
 */
export default {
  name: "RightsModal",
  components: {BasicTable,  BasicModal, BasicButton },
  computed: {
    systemRoles() {
      return this.$store.getters["admin/getSystemRoles"];
    },
    userRight() {
      const rightObj = this.$store.getters["admin/getUserRight"];
      const formattedRights = {};

      for (const [roleId, rights] of Object.entries(rightObj)) {
        const { name: roleName } = this.systemRoles.find(({ id }) => id === +roleId);
        if (roleName === "admin") {
          formattedRights[roleName] = [this.$t('dashboard.users.adminHasFullRights')];
        } else if (rights.length === 0) {
          formattedRights[roleName] = [this.$t('dashboard.users.roleNoAssociatedRights')];
        } else {
          formattedRights[roleName] = rights;
        }
      }
      return formattedRights;
    },
    rightColumns() {
      return [
        { name: this.$t("dashboard.users.userRole"), key: "role", width: 3 },
        { name: this.$t("dashboard.users.userRight"), key: "rights" },
      ];
    },
    rightRows() {
      return Object.entries(this.userRight).map(([role, rights]) => ({
        id: role,
        role: this.tSystemRoleName(role),
        rights: rights.join(", "),
      }));
    },
  },
  methods: {
    tSystemRoleName(roleName) {
      const key = `users.roles.${roleName}`;
      return this.$te(key) ? this.$t(key) : roleName;
    },
    open(userId) {
      this.$refs.modal.open();
      this.$socket.emit("userGetRight", {
        userId: userId
      }, (response) => {
        if (!response.success) {
          this.eventBus.emit("toast", {
            title: this.$t('errors.users.errorFetchingUserRights'),
            message: resolveApiMessage(response),
            variant: "danger",
          });
        }
      });
    },
  },
};
</script>

<style scoped>
.table-container {
  display: flex;
  align-items: center;
  justify-content: center;
  max-height: 400px;
  min-height: 150px;
  overflow-y: scroll;
}
.table-container > p {
  font-weight: 800;
}
</style>
