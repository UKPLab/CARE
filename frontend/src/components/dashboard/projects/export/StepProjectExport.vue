<template>
  <div>
    <div v-if="exportType === 'reviewerList'">
      <p>{{ $t('dashboard.projects.exportStudySessions') }}</p>
      <p>
        {{ $t('dashboard.projects.totalStudies') }} {{ studies.length }}<br>
        {{ $t('dashboard.projects.totalStudySessions') }} {{ studySessions.length }}
      </p>
    </div>
    <div v-else>
      <p>{{ $t('dashboard.projects.exportingAllData') }}</p>
      <p>
        {{ $t('dashboard.projects.totalStudies') }} {{ studies.length }}<br>
        {{ $t('dashboard.projects.totalStudySessions') }} {{ studySessions.length }}<br>
        {{ $t('dashboard.projects.totalTags') }} {{ tags.length }}<br>
        {{ $t('dashboard.projects.totalTagSets') }} {{ tagSets.length }}<br>
        {{ $t('dashboard.projects.totalProjects') }} {{ projects.length }}<br>
        {{ $t('dashboard.projects.totalDocuments') }} {{ documents.length }}<br>
        {{ $t('dashboard.projects.totalAnnotations') }} {{ annotations.length }}<br>
        {{ $t('dashboard.projects.totalComments') }} {{ comments.length }}<br>
        {{ $t('dashboard.projects.totalCommentsVotes') }} {{ commentVotes.length }}<br>
        {{ $t('dashboard.projects.totalEdits') }} {{ edits.length }}<br>
      </p>
    </div>
  </div>
</template>

<script>
import {downloadObjectsAs} from "@/assets/utils";
import JSZip from 'jszip';
import FileSaver from 'file-saver';
import Quill from "quill";
import DOMPurify from 'dompurify';
import {dbToDelta} from "editor-delta-conversion";

/**
 * Confirmation step for the whole-project exports ("reviewerList" and "all"):
 * summarises what will be exported and builds the download in download().
 * The parent export modal subscribes to all tables used here.
 */
export default {
  name: "StepProjectExport",
  props: {
    projectId: {
      type: [Number, String],
      default: null,
    },
    exportType: {
      type: String,
      required: true,
    },
  },
  computed: {
    studies() {
      return this.$store.getters["table/study/getFiltered"]((s) => s.projectId === this.projectId);
    },
    tagSets() {
      return this.$store.getters["table/tag_set/getFiltered"]((ts) => ts.projectId === this.projectId);
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
    /**
     * Download the export for the current export type.
     * @returns {Promise<void>}
     */
    async download() {
      if (this.exportType === "reviewerList") {
        this.downloadReviewerList();
      } else {
        await this.downloadAllData();
      }
    },
    downloadReviewerList() {
      const filename = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '_session_list';
      downloadObjectsAs(this.reviewerList, filename, "csv");
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
    async downloadAllData() {
      const zip = new JSZip();

      zip.file('tags.json', JSON.stringify(this.tags, null, 2));
      zip.file('tag_sets.json', JSON.stringify(this.tagSets, null, 2));
      zip.file('project.json', JSON.stringify(
          this.projects.filter(project => project.id === this.projectId),
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

            case 2: { // Editor
              // download edits + html
              const edits = this.edits.filter(edit => (
                  edit.documentId === step.documentId && edit.studyStepId === null && edit.studySessionId === null
              ) || (
                  edit.documentId === step.documentId && edit.studyStepId === step.id && edit.studySessionId === session.id
              ));

              step_folder.file('edits.json', JSON.stringify(edits, null, 2));

              deltas = dbToDelta(edits);
              quill.setContents(deltas);
              // Quill's HTML export can contain unescaped embed values (CVE-2025-15056).
              const html = DOMPurify.sanitize(quill.getSemanticHTML(), {
                USE_PROFILES: {html: true},
              });
              step_folder.file('html.html', html);
              step_folder.file('text.txt', quill.getText());
              step_folder.file('document.delta', JSON.stringify(deltas, null, 2));
              break;
            }
          }
        });
      });

      zip.generateAsync({type: "blob"})
          .then((content) => {
            FileSaver.saveAs(content, "export.zip");
          });

    },
  },
};
</script>
