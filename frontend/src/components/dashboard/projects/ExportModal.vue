<template>
  <StepperModal
    ref="exportStepper"
    :steps="steps"
    :validation="stepValid"
    submit-text="Download"
    xl
    @submit="downloadData"
    @hide="hide">
    <template #title>
      <h5 class="modal-title">Export Data</h5>
    </template>

    <template #step-1>
      <BasicForm
        ref="dataSelectionForm"
        v-model="dataSelection"
        :fields="dataSelectionFields"
      />
    </template>

    <!--
    <template #step-2>
      <div class="table-scroll-container">
        <div class="list-group">
          <button
            v-for="(f, i) in filter"
            :key="f"
            type="button"
            class="list-group-item d-flex justify-content-between list-group-item-action"
            @click="openFilterModal(i)">
            <div v-if="f.data" class="ms-2 me-auto">
              <div class="fw-bold">Filter for {{ f.data.options.table }}</div>
              Include entries from {{ f.data.options.table }}
            </div>
            <span v-if="f.data"  class="badge bg-primary rounded-pill">{{ f.data.selected.length }} </span>
            <FilterModal
              :ref="'filter_' + i"
              v-model="f.data"/>
          </button>
        </div>
        <br>
        <BasicButton
          class="btn btn-primary"
          title="Add Filter"
          @click="filter.push({data: null})"
        />
      </div>
    </template>
    -->

    <template #step-2>

      <div v-if="dataSelection.exportType === 'reviewerList'">
        <p>Exporting a list of all study sessions with hash:</p>

        <p>
          Total Studies: {{ studies.length }}<br>
          Total Study Sessions: {{ studySessions.length }}
        </p>
      </div>

    </template>
  </StepperModal>
</template>

<script>
import BasicForm from "@/basic/Form.vue";
import StepperModal from "@/basic/modal/StepperModal.vue";
import {computed} from "vue";
import {downloadObjectsAs} from "@/assets/utils";

/**
 * ProjectModal - modal component for adding and editing projects
 *
 * @author Dennis Zyska
 */
export default {
  name: "ExportProjectModal",
  components: {StepperModal, BasicForm},
  subscribeTable: [{
    table: "document",
  }, {
    table: "user",
    include: [{
      table: "study_session",
      by: "userId",
      type: "count",
      as: "studySessions"
    }]
  }, {
    table: "study",
  }, {
    table: "study_session",
  }
  ],
  provide() {
    return {
      exportStepper: computed(() => this.$refs.exportStepper),
    }
  },
  data() {
    return {
      dataSelection: {
        projectId: null,
        exportType: "reviewerList",
      },
      filter: [],
    }
  },
  computed: {
    stepValid() {
      return [
        true
      ];
    },
    steps() {
      return [
        {title: "Settings"},
        {title: "Confirmation"}
      ];
    },
    dataSelectionFields() {
      return [
        {
          key: "projectId",
          label: "Project",
          type: "select",
          options: this.projects.map(project => ({
            name: project.name,
            value: project.id,
          })),
          required: true,
        },
        {
          key: "exportType",
          label: "Export Type",
          type: "select",
          options: [
            {name: "Export a list of all reviewers", value: "reviewerList"},
            {name: "All", value: "all", disabled: true},
          ],
          required: true,
        }
      ]
    },
    studies() {
      return this.$store.getters["table/study/getFiltered"]((s) => s.projectId === this.dataSelection.projectId);
    },
    studySessions() {
      return this.$store.getters["table/study_session/getFiltered"]((s) => this.studies.map(study => study.id).includes(s.studyId));
    },
    reviewerList() {
      return this.studySessions.map(session => {

        const study = this.$store.getters["table/study/get"](session.studyId);
        const studyUser = this.$store.getters["table/user/get"](study.userId);
        const studySessionUser = this.$store.getters["table/user/get"](session.userId);

        return {
          "studyUserName": studyUser.firstName + " " + studyUser.lastName,
          "studyUserFirstName": studyUser.firstName,
          "studyUserLastName": studyUser.lastName,
          "studySessionUserName": studySessionUser.firstName + " " + studySessionUser.lastName,
          "studySessionUserFirstName": studySessionUser.firstName,
          "studySessionUserLastName": studySessionUser.lastName,
          "studySessionHash": session.hash,
        }
      });
    },
    projects() {
      return this.$store.getters["table/project/getAll"];
    },
  },
  methods: {
    open(projectId) {
      this.dataSelection.projectId = projectId;
      this.$refs.exportStepper.open();
    },
    hide() {
      this.filter = [];
    },
    downloadData() {
      if (this.dataSelection.exportType === "reviewerList") {
        this.downloadReviewerList();
      }
    },
    downloadReviewerList() {
      const filename = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '_session_list';
      downloadObjectsAs(this.reviewerList, filename, "csv");
    },
    /*
    openFilterModal(i) {
      console.log(this.$refs);
      console.log(i);
      this.$refs['filter_' + i][0].open();
    }
    */
  }
}
</script>

<style scoped>

</style>