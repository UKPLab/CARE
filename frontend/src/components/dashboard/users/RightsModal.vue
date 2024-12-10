<template>
  <BasicModal ref="modal">
    <template #title>
      <slot name="title">
        <span>View User Right</span>
      </slot>
    </template>
    <template #body>
      <div class="table-container">
        <!-- Check if it is an empty object. -->
        <template v-if="Object.keys(userRight).length === 0">
          <p>This user has no assigned rights</p>
        </template>
        <template v-else>
          <table>
            <thead>
              <tr>
                <th>User Role</th>
                <th>User Right</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(rights, role) in userRight"
                :key="role"
              >
                <td>{{ role }}</td>
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
          title="Okay"
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
          formattedRights[roleName] = ["admin has full rights"];
        } else if (rights.length === 0) {
          formattedRights[roleName] = ["this role does not have associated rights yet"];
        } else {
          formattedRights[roleName] = rights;
        }
      }
      return formattedRights;
    },
  },
  methods: {
    open(userId) {
      this.$refs.modal.open();
      this.$socket.emit("userGetRight", userId);
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
