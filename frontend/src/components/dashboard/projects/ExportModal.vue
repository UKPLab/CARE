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

      <div v-if="wait">
        <BasicLoading/>
      </div>

      <div v-else-if="dataSelection.exportType === 'reviewerList'">
        <p>Exporting a list of all study sessions with hash:</p>

        <p>
          Total Studies: {{ studies.length }}<br>
          Total Study Sessions: {{ studySessions.length }}
        </p>
      </div>
      <div v-else>
        <p>Exporting all data</p>

        <p>
          Total Studies: {{ studies.length }}<br>
          Total Study Sessions: {{ studySessions.length }}<br>
          Total Tags: {{ tags.length }}<br>
          Total Tag Sets: {{ tagSets.length }}<br>
          Total Projects: {{ projects.length }}<br>
          Total Documents: {{ documents.length }}<br>
          Total Annotations: {{ annotations.length }}<br>
          Total Comments: {{ comments.length }}<br>
          Total Comment Votes: {{ commentVotes.length }}<br>
          Total Edits: {{ edits.length }}<br>
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
import JSZip from 'jszip';
import FileSaver from 'file-saver';
import Quill from "quill";
import {dbToDelta} from "editor-delta-conversion";
import BasicLoading from "@/basic/Loading.vue";


/**
 * ProjectModal - modal component for adding and editing projects
 *
 * @author Dennis Zyska
 */
export default {
  name: "ExportProjectModal",
  components: {BasicLoading, StepperModal, BasicForm},
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
  }, {
    table: "tag_set",
  }, {
    table: "tag"
  }, {
    table: "document"
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
      wait: false,
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
            {name: "All", value: "all"},
          ],
          required: true,
        }
      ]
    },
    studies() {
      return this.$store.getters["table/study/getFiltered"]((s) => s.projectId === this.dataSelection.projectId);
    },
    tagSets() {
      return this.$store.getters["table/tag_set/getFiltered"]((ts) => ts.projectId === this.dataSelection.projectId);
    },
    tags() {
      return this.$store.getters["table/tag/getFiltered"](tag => this.tagSets.map(tagSet => tagSet.id).includes(tag.tagSetId));
    },
    studySteps() {
      return this.$store.getters["table/study_step/getFiltered"]((s) => this.studies.map(study => study.id).includes(s.studyId));
    },
    studySessions() {
      return this.$store.getters["table/study_session/getFiltered"]((s) => this.studies.map(study => study.id).includes(s.studyId));
    },
    edits() {
      return this.$store.getters["table/document_edit/getFiltered"]((e) => e.text !== '\n\nDo you find the feedback helpful?');
    },
    documents() {
      return this.$store.getters["table/document/getAll"];
    },
    annotations() {
      return this.$store.getters["table/annotation/getAll"];
    },
    comments() {
      return this.$store.getters["table/comment/getAll"];
    },
    commentVotes() {
      return this.$store.getters["table/comment_vote/getAll"];
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
      } else {
        this.downloadAllData();
      }
    },
    downloadReviewerList() {
      const filename = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '_session_list';
      downloadObjectsAs(this.reviewerList, filename, "csv");
      this.$refs.exportStepper.close();
    },
    async downloadAllData() {

      this.wait = true;

      const zip = new JSZip();

      zip.file('tags.json', JSON.stringify(this.tags, null, 2));
      zip.file('tag_sets.json', JSON.stringify(this.tagSets, null, 2));
      zip.file('project.json', JSON.stringify(this.projects.filter(
        project => project.id === this.dataSelection.projectId
      ), null, 2));
      zip.file('studies.json', JSON.stringify(this.studies, null, 2));
      zip.file("reviewers.json", JSON.stringify(this.reviewerList, null, 2));
      zip.file("sessions.json", JSON.stringify(this.studySessions, null, 2));
      zip.file("documents.json", JSON.stringify(this.documents, null, 2));

      //download all documents
      await Promise.all(
        this.studySessions.flatMap(session =>
          this.studySteps
            .filter(step => step.studyId === session.studyId)
            .map(step =>
              new Promise((resolve) => {
                this.$socket.emit("documentGetData", {
                  documentId: step.documentId,
                  studySessionId: session.id,
                  studyStepId: step.id,
                  history: true,
                }, (response) => {
                  resolve(response); // Löst das Promise auf, wenn die Antwort kommt
                });
              })
            )
        )
      );

      // wait a bit to make sure all requests are finished
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log("✅ Alle Requests abgeschlossen!");

      let quill = new Quill(document.createElement('div'));

      // add folder with all sessions
      const sessions = zip.folder("sessions");
      this.studySessions.forEach(session => {
        // add folder in documents for each session
        const session_folder = sessions.folder(session.hash);
        session_folder.file('session.json', JSON.stringify(session, null, 2));
        // create folder for each step in the session
        session_folder.file('steps.json', JSON.stringify(this.studySteps.filter(step => step.studyId === session.studyId), null, 2));
        this.studySteps.filter(step => step.studyId === session.studyId).forEach((step, i) => {
          const step_folder = session_folder.folder("step" + i);
          step_folder.file('step.json', JSON.stringify(step, null, 2));
          step_folder.file('document.json', JSON.stringify(this.documents.find(doc => doc.id === step.documentId), null, 2));
          let deltas = undefined;
          let relevantComments;
          switch (step.stepType) {
            case 1: // Annotator
              // download inline annotations
              step_folder.file('annotations.json', JSON.stringify(this.annotations.filter(
                  ann => ann.studyStepId === step.id && ann.studySessionId === session.id), null, 2));
              relevantComments = this.comments.filter(comm => comm.studyStepId === step.id && comm.studySessionId === session.id);
              step_folder.file('comments.json', JSON.stringify(relevantComments, null, 2));
              step_folder.file('comment_votes.json', JSON.stringify(this.commentVotes.filter(vote => relevantComments.map(comm => comm.id).includes(vote.commentId)), null, 2));

              break;
            case 2: // Editor
              // download edits + html
                const edits = this.edits.filter(edit => (
                    edit.documentId === step.documentId && edit.studyStepId === null && edit.studySessionId === null
                ) || (
                    edit.documentId === step.documentId && edit.studyStepId === step.id && edit.studySessionId === session.id
                ));
              step_folder.file('edits.json', JSON.stringify(edits), null, 2);
              deltas = dbToDelta(edits);
              quill.setContents(deltas);
              step_folder.file('html.html', quill.getSemanticHTML());
              step_folder.file('text.txt', quill.getText());
              step_folder.file('document.delta', JSON.stringify(deltas, null, 2));

              break;
          }
        });
      });

      zip.generateAsync({type: "blob"})
        .then((content) => {
          FileSaver.saveAs(content, "export.zip");
        });

      this.wait = false;
      this.$refs.exportStepper.close();

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