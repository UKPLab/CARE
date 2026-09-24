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
          <table>
            <thead>
              <tr>
                <th>{{$t('dashboard.users.userRole')}}</th>
                <th>{{$t('dashboard.users.userRight')}}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(rights, role) in userRight"
                :key="role"
              >
                <td>{{ tSystemRoleName(role) }}</td>
                <td>
                  <ul>
                    <li
                      v-for="right in rights"
                      :key="right"
                    >
                      {{ right }}
                    </li>
                  </ul>
                </td>
              </tr>
            </tbody>
          </table>
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

/**
 * Modal for viewing the rights the user has on this platform
 * @author: Linyin Huang
 */
export default {
  name: "RightsModal",
  components: { BasicModal, BasicButton },
  data() {
    return {};
  },
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
table {
  width: 100%;
}
th,
td {
  padding: 10px;
  text-align: left;
  border: 1px solid #ddd;
}
th:first-child,
td:first-child {
  width: 25%;
}
ul {
  margin-bottom: 0;
  padding-left: 1rem;
}
</style>
