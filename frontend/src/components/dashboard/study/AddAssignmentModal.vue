<template>
  <BasicModal
    ref="assignmentModal"
    name="add-assignment-modal"
    size="xl"
    @hide="resetModal"
  >
    <template #title>
      <span>{{$t('dashboard.study.addSingleAssignment')}}</span>
    </template>
    <template #body>
      <BasicTable
        v-model="selectedReviewer"
        :columns="reviewerTableColumns"
        :data="reviewerTable"
        :options="reviewerTableOptions"
        :max-table-height="400"
      />
    </template>

    <template #footer>
      <div>
        <BasicButton
          :title="(selectedReviewer.length === 1) ? $t('dashboard.study.addReviewer') : $t('dashboard.study.addReviewers')"
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
import { resolveApiMessage } from "@/assets/utils";

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
        pagination: 10,
      },
    };
  },
  computed: {
    reviewerTableColumns() {
      const columns = [
        {name: this.$t('common.id'), key: "id"},
        {name: this.$t('common.userName'), key: "userName"},
      ];
      if (this.canReadPrivateInformation) {
        columns.push(
          {name: this.$t('common.firstName'), key: "firstName"},
          {name: this.$t('common.lastName'), key: "lastName"},
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
            title: this.$t('dashboard.study.reviewersAdded'),
            message: this.$t('dashboard.study.reviewersAddedMessage'),
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: this.$t('dashboard.study.failedToAddReviewers'),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      });
    },
  },

};
</script>

<style scoped>
</style>
