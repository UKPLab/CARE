<template>
  <StepperModal
      ref="exportStepper"
      :steps="steps"
      :validation="stepValid"
      submit-text="Download"
      size = "xl"
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
      <div v-else-if="dataSelection.exportType === 'submissions'">
        <h6>Select Submissions to Download:</h6>

        <div v-if="submissionTableData.length > 0" class="mb-3" style="max-width: 300px;">
          <b-form-select 
            v-model="sharingFilter" 
            :options="filterOptions"
            size="sm"
          ></b-form-select>
        </div>

        <BasicTable
          v-if="filteredSubmissionTableData.length > 0"
          v-model="submissionSelection" 
          :columns="submissionTable.columns"
          :data="filteredSubmissionTableData"
          :options="submissionTable.options"
        />

        <div v-else class="alert alert-warning">
          <span v-if="submissionTableData.length === 0">
            No submissions found for this project.
          </span>
          <span v-else>
            No submissions match your current filter.
          </span>
        </div>

        <small class="text-muted">
          {{ submissionSelection.length }} student(s) selected
        </small>
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

    
    <template #step-3>
      <div v-if="wait">
        <BasicLoading/>
      </div>
      <div v-if="dataSelection.exportType === 'submissions'" class="mb-3">
        <h6>Confirm Selection:</h6>
        <div class="alert alert-info">
          <strong>Summary:</strong><br />
          You are about to download submissions for 
          <strong>{{ submissionSelection.length }}</strong> student(s).
        </div>

        <div class="card card-body bg-light" style="max-height: 150px; overflow-y: auto;">
          <ul class="mb-0 pl-3">
            <li v-for="row in submissionSelection" :key="row.userId">
              {{ row.studentName }} ({{ row.fileCount }} files)
            </li>
          </ul>
        </div>

      </div>
    </template>

  </StepperModal>
</template>

<script>
import BasicForm from "@/basic/Form.vue";
import BasicTable from "@/basic/Table.vue";
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
 * @author Dennis Zyska, Mélissa Loew
 */
export default {
  name: "ExportProjectModal",
  components: {BasicLoading, StepperModal, BasicForm, BasicTable },
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

      sharingFilter: 'all',
      filterOptions: [
        { value: 'all', text: 'Show All Students' },
        { value: 'accepted', text: 'Only Accepted Data Sharing' },
        { value: 'declined', text: 'Only Declined Data Sharing' }
      ],

      submissionSelection: [],

      submissionTable: {
        options: {
          selectableRows: true,
          selectMode: 'multi',
          pagination: 10,
          striped: true,
          hover: true
        },
        columns: [
          { name: "Student Name", key: "studentName", sortable: true },
          { name: "Files", key: "fileCount", sortable: true },
          { name: "Accepted Data Sharing", key: "acceptDataSharing", sortable: true },
          { name: "Last Submitted", key: "lastSubmissionDate", sortable: true }
        ]
      }
    };
  },
  computed: {
    stepValid() {
      if (this.dataSelection.exportType === "submissions") {
        return [
          !!this.dataSelection.projectId,
          this.submissionSelection.length > 0,
          !this.wait
        ];
      }
      return [
        !!this.dataSelection.exportType,
        true
      ];
    },
    users() {
      return this.$store.getters["table/user/getAll"];
    },
    steps() {
      if (this.dataSelection.exportType === 'submissions') {
        return [
          { title: "Settings" },
          { title: "Select Students" },
          { title: "Confirm Download" }
        ];
      }
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
            {name: "Export submissions", value: "submissions"},
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
    submissionTableData() {
      const currentUser = this.$store.getters["auth/getUser"];
      
      if (!this.documents || !this.users || !this.dataSelection.projectId) {
        return [];
      }

      const projectDocs = this.documents.filter(doc => doc.projectId == this.dataSelection.projectId && doc.submissionId && !doc.parentSubmissionId);
      const submissionsByUser = {};
      projectDocs.forEach(doc => {
        const uid = doc.userId;
        if (!uid) return;

        let student = this.users.find(u => u.id === uid);
        if (!student && currentUser && currentUser.id === uid) {
          student = currentUser;
        }

        if (student) {
          const currentDocDate = new Date(doc.createdAt);

          if (!submissionsByUser[uid]) {
            submissionsByUser[uid] = {
              userId: uid,
              studentName: `${student.firstName} ${student.lastName}`,
              fileCount: 0,
              acceptDataSharing: student.acceptDataSharing,
              lastSubmissionDate: currentDocDate
            };
          }
          submissionsByUser[uid].fileCount++;

          if (currentDocDate > submissionsByUser[uid].lastSubmissionDate) {
            submissionsByUser[uid].lastSubmissionDate = currentDocDate;
          }
        }
      });
      return Object.values(submissionsByUser).map(submission => ({
        ...submission,
        lastSubmissionDate: submission.lastSubmissionDate.toISOString().split('T')[0]
      }));
    },
    filteredSubmissionTableData() {
      let data = this.submissionTableData;

      if (this.sharingFilter === 'accepted') {
        return data.filter(row => row.acceptDataSharing === true);
      } 
      
      if (this.sharingFilter === 'declined') {
        return data.filter(row => row.acceptDataSharing === false);
      }

      return data;
    }
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
      } else if (this.dataSelection.exportType === "submissions") {
        this.downloadSubmissions();
      } else {
        this.downloadAllData();
      }
    },
    downloadReviewerList() {
      const filename = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '_session_list';
      downloadObjectsAs(this.reviewerList, filename, "csv");
      this.$refs.exportStepper.close();
    },
    async fetchAllDocumentData(maxConcurrent = 3) {
      if (maxConcurrent < 1) {
        maxConcurrent = 1;
      }

      // Build a flat list of tasks
      const tasks = [];
      this.studySessions.forEach(session => {
        this.studySteps
            .filter(step => step.studyId === session.studyId)
            .forEach(step => {
              tasks.push({session, step});
            });
      });

      const emitWithAck = ({session, step}) => {
        return new Promise((resolve) => {
          this.$socket.emit(
              "documentGetData",
              {
                documentId: step.documentId,
                studySessionId: session.id,
                studyStepId: step.id,
                history: true,
              },
              (response) => {
                resolve(response);
              }
          );
        });
      };

      const results = new Array(tasks.length);
      let index = 0;

      const worker = async () => {
        while (index < tasks.length) {
          const current = index++;
          const task = tasks[current];
          const response = await emitWithAck(task);
          results[current] = response;
        }
      };

      const workerCount = Math.min(maxConcurrent, tasks.length);
      const workers = Array.from({length: workerCount}, () => worker());

      await Promise.all(workers);

      return results;
    },
    async downloadSubmissions() {
      this.wait = true;

      try {
        const selectedUserIds = this.submissionSelection.map(row => row.userId);

        this.triggerStreamDownload({
          projectId: this.dataSelection.projectId,
          exportType: 'submissions',
          userIds: selectedUserIds
        });

        this.wait = false;
        this.$refs.exportStepper.close();
      } catch (error) {
        console.error("Streaming error:", error);
        alert("An error occurred starting the stream.");
        this.wait = false;
      }
    },
    async downloadAllData() {
      this.wait = true;

      const zip = new JSZip();

      zip.file('tags.json', JSON.stringify(this.tags, null, 2));
      zip.file('tag_sets.json', JSON.stringify(this.tagSets, null, 2));
      zip.file('project.json', JSON.stringify(
          this.projects.filter(project => project.id === this.dataSelection.projectId),
          null,
          2
      ));
      zip.file('studies.json', JSON.stringify(this.studies, null, 2));
      zip.file("reviewers.json", JSON.stringify(this.reviewerList, null, 2));
      zip.file("sessions.json", JSON.stringify(this.studySessions, null, 2));

      //  fetch all document data with limited concurrency
      await this.fetchAllDocumentData(3);

      // keep the small delay to ensure all state is updated
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log("Requests done!");

      let quill = new Quill(document.createElement('div'));

      // add folder with all sessions
      const sessions = zip.folder("sessions");
      this.studySessions.forEach(session => {
        // add folder in documents for each session
        const session_folder = sessions.folder(session.hash);
        session_folder.file('session.json', JSON.stringify(session, null, 2));

        const stepsForSession = this.studySteps.filter(step => step.studyId === session.studyId);
        session_folder.file('steps.json', JSON.stringify(stepsForSession, null, 2));

        stepsForSession.forEach((step, i) => {
          const step_folder = session_folder.folder("step" + i);
          step_folder.file('step.json', JSON.stringify(step, null, 2));
          step_folder.file('document.json', JSON.stringify(
              this.documents.find(doc => doc.id === step.documentId),
              null,
              2
          ));

          let deltas;
          let relevantComments;

          switch (step.stepType) {
            case 1: // Annotator
              // download inline annotations
              step_folder.file(
                  'annotations.json',
                  JSON.stringify(
                      this.annotations.filter(
                          ann => ann.studyStepId === step.id && ann.studySessionId === session.id
                      ),
                      null,
                      2
                  )
              );

              relevantComments = this.comments.filter(
                  comm => comm.studyStepId === step.id && comm.studySessionId === session.id
              );
              step_folder.file('comments.json', JSON.stringify(relevantComments, null, 2));

              step_folder.file(
                  'comment_votes.json',
                  JSON.stringify(
                      this.commentVotes.filter(vote =>
                          relevantComments.map(comm => comm.id).includes(vote.commentId)
                      ),
                      null,
                      2
                  )
              );
              break;

            case 2: // Editor
              // download edits + html
              const edits = this.edits.filter(edit => (
                  edit.documentId === step.documentId && edit.studyStepId === null && edit.studySessionId === null
              ) || (
                  edit.documentId === step.documentId && edit.studyStepId === step.id && edit.studySessionId === session.id
              ));

              step_folder.file('edits.json', JSON.stringify(edits, null, 2));

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
    triggerStreamDownload(payload) {
      const serverUrl = import.meta.env.VITE_APP_SERVER_URL || "";
    
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `${serverUrl}/export/project/stream`;
      form.style.display = 'none';

      for (const [key, value] of Object.entries(payload)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        
        input.value = (typeof value === 'object' && value !== null) 
          ? JSON.stringify(value) 
          : value;
          
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
    }
  }
}
</script>

<style scoped>

</style>