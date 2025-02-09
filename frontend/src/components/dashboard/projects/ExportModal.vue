<template>
  <StepperModal
    ref="exportStepper"
    :steps="steps"
    :validation="stepValid"
    @submit="downloadData"
    xl>
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

    <template #step-3>

    </template>
  </StepperModal>
</template>

<script>
import BasicForm from "@/basic/Form.vue";
import StepperModal from "@/basic/modal/StepperModal.vue";
import FilterModal from "@/components/dashboard/projects/FilterModal.vue";
import {computed} from "vue";
import BasicButton from "@/basic/Button.vue";

/**
 * ProjectModal - modal component for adding and editing projects
 *
 * @author Dennis Zyska
 */
export default {
  name: "ExportProjectModal",
  components: {BasicButton, FilterModal, StepperModal, BasicForm},
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
        {title: "Filter"},
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
    projects() {
      return this.$store.getters["table/project/getAll"];
    },
  },
  methods: {
    open(projectId) {
      this.dataSelection.projectId = projectId;
      this.filter = [];
      this.$refs.exportStepper.open();
    },
    downloadData() {
      console.log("Download data");
    },
    openFilterModal(i) {
      console.log(this.$refs);
      console.log(i);
      this.$refs['filter_' + i][0].open();
    }
  }
}
</script>

<style scoped>
.table-scroll-container {
  max-height: 400px;
  overflow-y: auto;
}
</style>