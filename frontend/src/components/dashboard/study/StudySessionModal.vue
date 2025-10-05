<template>
  <AddAssignmentModal
    ref="addAssignmentModal"
    name="addAssignmentModal"
  />
  <BasicModal
    ref="studySessionModal"
    :props="{ studyId: studyId }"
    size="lg"
    name="studySessionModal"
    remove-close
  >
    <template #title>
      <span> Study Sessions of {{ studyName }} </span>
    </template>
    <template #body>
      <StudySessionTable
        :study-id="studyId"
        :current-user-only="false"
        @update="$emit('update')"
        @session-deleted="$emit('session-deleted', $event)"
        @session-opened="$emit('session-opened', $event)"
      />
    </template>
    <template #footer>
      <span class="btn-group">
        <BasicButton
          class="btn btn-secondary"
          title="Close"
          @click="close"
        />
      </span>
      <BasicButton
        v-if="isAdmin"
        class="btn btn-primary"
        title="Add"
        @click="addSingleAssignment"
      />
    </template>
  </BasicModal>
</template>

<script>

import BasicButton from "@/basic/Button.vue";
import AddAssignmentModal from "./AddAssignmentModal.vue";
import BasicModal from "@/basic/Modal.vue";
import { computed } from "vue";
import StudySessionTable from "./StudySessionTable.vue";

/**
 * Details of study session for a given study in a modal
 *
 * Modal including the details of existing study sessions for a study.
 *
 * @author: Nils Dycke, Dennis Zyska, Linyin Huang
 */
export default {
  name: "StudySessionModal",
  components: { BasicButton, AddAssignmentModal, BasicModal, StudySessionTable },
  provide() {
    return {
      mainModal: computed(() => this.$refs.studySessionModal),
    };
  },
  emits: ["update", "session-deleted", "session-opened"],
  data() {
    return {
      studyId: 0,
    };
  },
  computed: {
    study() {
      return this.studyId ? this.$store.getters["table/study/get"](this.studyId) : null;
    },
    studyName() {
      return this.study ? this.study.name : "unknown";
    },
    canAddSingleAssignments() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.addSingleAssignments");
    },
    isAdmin() {
      return this.$store.getters["auth/isAdmin"];
    },
  },
  methods: {
    open(studyId) {
      this.studyId = studyId;
      this.load();
      this.$socket.emit("studySessionSubscribe", { studyId: studyId });
      this.$refs.studySessionModal.open();
    },
    close() {
      this.$socket.emit("studySessionUnsubscribe", { studyId: this.studyId });
      this.$refs.studySessionModal.close();
    },
    addSingleAssignment() {
      this.$refs.addAssignmentModal.open(this.studyId);
    },
    load() {
      if (!this.study) {
        this.$socket.emit("studyGetById", { studyId: this.studyId });
      }
    },
  },
};
</script>

<style scoped></style>
