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
                <template v-if="role === 'admin'">
                  <td>admin</td>
                  <td>admin has full rights</td>
                </template>
                <template v-else>
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
                </template>
              </tr>
            </tbody>
          </table>
        </template>
      </div>
    </template>
    <template #footer>
      <span class="btn-group">
        <button
          type="button"
          class="btn btn-primary"
          @click="$refs.modal.close()"
        >
          Okay
        </button>
      </span>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";

/**
 * Modal for viewing the rights the user has on this platform
 * @author: Linyin Huang
 */
export default {
  name: "RightsModal",
  components: { BasicModal },
  data() {
    return {
      userRight: {},
    };
  },
  computed: {
    userRight() {
      return this.$store.getters["admin/getUserRight"];
    },
  },
  methods: {
    open(userId) {
      this.$refs.modal.open();
      this.getUserRights(userId);
    },
    getUserRights(userId) {
      this.$socket.emit("requestUserRight", userId);
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
