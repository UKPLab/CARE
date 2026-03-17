<template>
  <BasicModal
    ref="assignmentSubmissionsModal"
    :props="{ assignmentId: assignmentId }"
    size="lg"
    name="assignmentSubmissionsModal"
  >
    <template #title>
      <span>Submissions for {{ assignmentTitle }}</span>
    </template>
    <template #body>
      <BasicTable
        :columns="columns"
        :data="submissionTable"
        :options="tableOptions"
      />
    </template>
    <template #footer>
      <span class="btn-group">
        <BasicButton
          class="btn btn-primary"
          title="Upload Submission"
          text="Upload Submission"
          icon="file-earmark-arrow-up"
          @click="openUploadModal"
        />
        <BasicButton
          class="btn btn-secondary"
          title="Close"
          @click="close"
        />
      </span>
    </template>
  </BasicModal>
  <UploadModal ref="uploadModal" />
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import UploadModal from "@/components/dashboard/submission/UploadModal.vue";

export default {
  name: "AssignmentSubmissionsModal",
  subscribeTable: ["submission", "user", "assignment"],
  components: { BasicModal, BasicTable, BasicButton, UploadModal },
  data() {
    return {
      assignmentId: 0,
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
        search: true,
      },
      columns: [
        { name: "ID", key: "id" },
        { name: "Submission ID", key: "extId" },
        { name: "First Name", key: "firstName" },
        { name: "Last Name", key: "lastName" },
        { name: "Group", key: "group" },
        { name: "Created At", key: "createdAt" },
      ],
    };
  },
  computed: {
    assignment() {
      return this.assignmentId ? this.$store.getters["table/assignment/get"](this.assignmentId) : null;
    },
    assignmentTitle() {
      return this.assignment?.title || `Assignment #${this.assignmentId}`;
    },
    submissions() {
      return this.$store.getters["table/submission/getFiltered"](
        (submission) => submission.assignmentId === this.assignmentId
      );
    },
    submissionTable() {
      return this.submissions.map((submission) => {
        const user = this.$store.getters["table/user/get"](submission.userId);
        return {
          id: submission.id,
          extId: submission.extId ?? "-",
          firstName: user?.firstName || "Unknown",
          lastName: user?.lastName || "Unknown",
          group: submission.group ?? "-",
          createdAt: submission.createdAt ? new Date(submission.createdAt).toLocaleString() : "-",
        };
      });
    },
  },
  methods: {
    open(assignmentId) {
      this.assignmentId = assignmentId;
      this.$refs.assignmentSubmissionsModal.open();
    },
    openUploadModal() {
      this.$refs.uploadModal.open(this.assignmentId);
    },
    close() {
      this.$refs.assignmentSubmissionsModal.close();
    },
  },
};
</script>
