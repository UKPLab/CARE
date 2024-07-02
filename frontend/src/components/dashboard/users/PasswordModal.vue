<template>
  <BasicModal ref="modal">
    <template #title>
      <span>Reset Password</span>
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
          type="submit"
          class="btn btn-primary"
          @click="submit"
        >
          Confirm
        </button>
      </span>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicForm from "@/basic/Form.vue";

/**
 * Modal for resetting user's password
 *
 * @author: Linyin Huang
 */
export default {
  name: "PasswordModal",
  components: { BasicModal, BasicForm },
  data() {
    return {
      id: 0,
      data: {},
      fields: [
        {
          key: "password",
          type: "password",
          required: true,
          placeholder: "",
          pattern: "",
          default: "",
        },
      ],
    };
  },
  methods: {
    open(id) {
      this.$refs.modal.open(id);
    },
    submit() {
      const { modelValue } = this.$refs.form;
    },
  },
};
</script>

<style scoped></style>
