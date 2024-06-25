<template>
  <BasicModal ref="modal">
    <template #title>
      <slot name="title">
        <span>Edit User</span>
      </slot>
    </template>
    <template #body>
      <BasicForm
        ref="form"
        v-model="data"
        :fields="fields"
      />
    </template>
    <template #footer>
      <span class="btn-group">
        <button
          type="button"
          class="btn btn-secondary"
          @click="$refs.modal.close()"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-primary me-2"
          @click="submit"
        >
          Save
        </button>
      </span>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicForm from "@/basic/Form.vue";

/**
 * Modal for viewing and editing user data
 *
 * @author: Linyin Huang
 */
export default {
  name: "DetailsModal",
  components: { BasicModal, BasicForm },
  data() {
    return {
      id: 0,
      data: {},
      fields: [
        {
          key: "firstName",
          label: "First Name:",
          type: "text",
          required: true,
          // readOnly: true,
          default: "",
        },
        {
          key: "lastName",
          label: "Last Name:",
          type: "text",
          required: true,
          readOnly: true,
          default: "",
        },
        {
          key: "userName",
          label: "Username:",
          type: "text",
          required: true,
          readOnly: true,
          default: "",
        },
        // TODO: Check if password section should be separated from here.
        // {
        //   key: "password",
        //   label: "Password:",
        //   type: "password",
        //   required: true,
        //   readOnly: true,
        //   default: "",
        // },
        {
          key: "roles",
          label: "Roles:",
          type: "checkbox",
          required: true,
          readOnly: false,
          default: [],
          options: [
            { value: "admin", label: "Admin" },
            { value: "teacher", label: "Teacher" },
            { value: "mentor", label: "Mentor" },
            { value: "student", label: "Student" },
          ],
        },
        // {
        //   key: "right",
        //   label: "Rights:",
        //   type: "table",
        //   required: true,
        //   readOnly: true,
        //   default: "",
        //   options: {
        //     table: "",
        //   },
        // },
      ],
      editTimeout: null,
    };
  },
  computed: {
    user() {
      return this.$store.getters["table/user/get"](this.id);
    },
  },
  watch: {
    data(newVal) {
      console.log(newVal);
    },
  },
  methods: {
    open(id) {
      this.$refs.modal.open(id, this.user);
      // TODO: the following is test data
      this.data = {
        firstName: "Charlie",
      };
    },
    submit() {
      const { modelValue } = this.$refs.form;
      this.$socket.emit("testABC", modelValue);
    },
  },
};
</script>

<style scoped></style>
