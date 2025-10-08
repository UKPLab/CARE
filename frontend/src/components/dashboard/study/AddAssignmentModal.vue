<template>
  <BasicModal
    ref="assignmentModal"
    name="add-assignment-modal"
    size="xl"
    @hide="resetModal"
  >
    <template #title>
      <span>Add Single Assignment</span>
    </template>
    <template #body>
      <div class="table-scroll-container">
        <BasicTable
          v-model="selectedReviewer"
          :columns="reviewerTableColumns"
          :data="reviewerTable"
          :options="reviewerTableOptions"
        />
      </div>
    </template>

    <template #footer>
      <div>
        <BasicButton
          :title="(selectedReviewer.length === 1) ? 'Add Reviewer' : 'Add Reviewers'"
          class="btn btn-primary"
          :disabled="selectedReviewer.length === 0"
          @click="addReviewers"
        />
      </div>
    </template>

  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";

/**
 * Modal for adding a single assignment
 * @author: Dennis Zyska
 */
export default {
  name: "AddAssignmentModal",
  components: {
    BasicModal,
    BasicButton,
    BasicTable,
  },
  inject: {
    mainModal: {
      default: null
    },
  },
  data() {
    return {
      selectedReviewer: [],
      studyId: 0,
      reviewerTableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        scrollY: true,
        scrollX: true,
        search: true,
      },
    };
  },
  computed: {
    reviewerTableColumns() {
      const columns = [
        {name: "ID", key: "id"},
        {name: "Username", key: "userName"},
      ];
      if (this.canReadPrivateInformation) {
        columns.push(
          {name: "First Name", key: "firstName"},
          {name: "Last Name", key: "lastName"},
        );
      }

      return columns;
    },
    reviewerTable() {
      return this.$store.getters["table/user/getAll"];
    },
    users() {
      return this.$store.getters["admin/getAssignmentUserInfos"].filter(user => user.role != null);
    },
    canReadPrivateInformation() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.view.userPrivateInfo");
    },
  },
  methods: {
    open(id) {
      this.$refs.assignmentModal.open();
      this.mainModal?.hide()
      this.studyId = id
    },
    showMainModal() {
      this.mainModal?.show()
    },
    resetModal() {
      this.selectedReviewer = [];
      this.showMainModal();
    },
    addReviewers() {
      this.$refs.assignmentModal.waiting = true;
      this.$socket.emit("assignmentAdd", {
        reviewer: this.selectedReviewer,
        studyId: this.studyId,
      }, (res) => {
        this.$refs.assignmentModal.waiting = false;
        if (res.success) {
          this.$refs.assignmentModal.close();
          this.showMainModal();
          this.eventBus.emit("toast", {
            title: "Reviewers added",
            message: "The reviewers have been added successfully",
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to add reviewers",
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
  },

};
</script>

<style scoped>
.table-scroll-container {
  max-height: 400px;
  overflow-y: auto;
}
</style>
