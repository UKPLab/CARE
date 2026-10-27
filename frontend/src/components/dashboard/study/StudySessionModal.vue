<template>
  <AddAssignmentModal
    ref="addAssignmentModal"
    name="addAssignmentModal"
    @hide="onNestedModalHide"
  />
  <BasicModal
    ref="studySessionModal"
    :props="{ studyId: studyId }"
    size="lg"
    name="studySessionModal"
    remove-close
    @hide="onSessionModalHide"
  >
    <template #title>
      <i18n-t
        keypath="dashboard.study.studySessionsOf"
        tag="span"
      >
        <template #name>
          {{ studyName }}
        </template>
      </i18n-t>
    </template>
    <template #body>
      <StudySessionTable
        v-if="studyId"
        ref="sessionTable"
        :study-id="studyId"
        :study="study"
        :show-all="true"
        @session-deleted="$emit('session-deleted', $event)"
        @session-opened="$emit('session-opened', $event)"
      />
    </template>
    <template #footer>
      <span class="btn-group">
        <BasicButton
          class="btn btn-secondary"
          :title="$t('common.close')"
          @click="close"
        />
      </span>
      <BasicButton
        v-if="isAdmin"
        class="btn btn-primary"
        :title="$t('common.add')"
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
  emits: ["update", "session-deleted", "session-opened", "hide"],
  data() {
    return {
      studyId: 0,
      studyRecord: null,
      nestedModalOpen: false,
    };
  },
  computed: {
    study() {
      if (this.studyRecord && Number(this.studyRecord.id) === Number(this.studyId)) {
        return this.studyRecord;
      }
      return null;
    },
    studyName() {
      return this.study ? this.study.name : this.$t('common.unknown');
    },
    canAddSingleAssignments() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.addSingleAssignments");
    },
    isAdmin() {
      return this.$store.getters["auth/isAdmin"];
    },
  },
  methods: {
    open(studyId, studyRow = null) {
      this.studyId = studyId;
      this.studyRecord = studyRow ? { ...studyRow } : null;
      this.$refs.studySessionModal.open();
    },
    close() {
      this.$refs.studySessionModal.close();
    },
    onSessionModalHide() {
      if (this.nestedModalOpen) {
        return;
      }
      this.$emit("hide");
    },
    onNestedModalHide() {
      this.nestedModalOpen = false;
      this.$refs.sessionTable?.refetch?.();
    },
    addSingleAssignment() {
      this.nestedModalOpen = true;
      this.$refs.addAssignmentModal.open(this.studyId);
    },
  },
};
</script>

<style scoped></style>
