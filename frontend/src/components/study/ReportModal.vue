<template>
  <Modal
    ref="modal"
    :props="$props"
    lg
    name="studyReport"
    xl
  >
    <template #title>
      Review Report
    </template>
    <template #body>
      <p v-if="reportItems.length + noteItems.length === 0">
        Empty report -- no annotations or comments found.
      </p>
      <div v-else>
        <h2>General Comments</h2>
        <ul>
          <li
            v-for="n in noteItems"
            :key="n.id"
          >
            <ReportItem
              :comment-id="n.id"
              @show-report-comment="showComment"
            />
          </li>
        </ul>
      </div>
      <div
        v-for="s in reportSections"
        :key="s.id"
      >
        <h2>
          <span :class="`badge bg-${s.colorCode}`">
            {{ s.name }}
          </span>
        </h2>
        <ul>
          <li
            v-for="r in annotations.filter(a => a.tagId === s.id)"
            v-if="annotations.filter(a => a.tagId === s.id).length > 0"
            :key="r.id"
          >
            <ReportItem
              :annotation-id="r.id"
              @show-report-annotation="showAnnotation"
            />
          </li>
          <li v-else>
            No comments.
          </li>
        </ul>
        <!-- Add page notes -->
      </div>
      <p id="footnote">
        *Tip: Hover over a reference to see the referenced text or click to view the annotation in the
        PDF.
      </p>
    </template>
    <template #footer>
      <button
        class="btn btn-primary"
        data-bs-dismiss="modal"
        type="button"
      >
        Close
      </button>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import ReportItem from "./ReportItem.vue";

/**
 * Modal to show a report over comments/annotations
 *
 * @author: Nils Dycke, Dennis Zyska
 */
export default {
  name: "ReportModal",
  components: {Modal, ReportItem},
  inject: ['studySessionId'],
  emits: ['decisionSubmit'],
  computed: {
    studySession() {
      return this.$store.getters["table/study_session/get"](this.studySessionId);
    },
    study() {
      if (this.studySession) {
        return this.$store.getters["table/study/get"](this.studySession.studyId);
      } else {
        return null;
      }
    },
    documentId() {
      if (this.study) {
        return this.study.documentId;
      } else {
        return null;
      }
    },
    studySessionIds() {
      if (this.study) {
        return this.$store.getters["table/study_session/getByKey"]("studyId", this.studySession.studyId)
          .map(s => s.id);
      } else {
        return null;
      }
    },
    annotations() {
      return this.$store.getters['anno/getAnnotations'](this.documentId)
        .filter(anno => {
          if (this.studySessionIds) {
            return this.studySessionIds.includes(anno.studySessionId);
          } else {
            return false;
          }
        });
    },
    comments() {
      return this.$store.getters['comment/getDocumentComments'](this.documentId)
        .filter(comment => {
          if (this.studySessionIds) {
            return this.studySessionIds.includes(comment.studySessionId);
          } else {
            return false;
          }
        });
    },
    tags() {
      return this.$store.getters["tag/getAllTags"]();
    },
    tagIds() {
      if (this.annotations && this.tags) {
        return this.annotations.map(anno => anno.tagId).filter((value, index, array) => array.indexOf(value) === index);
      } else {
        return [];
      }
    },
    reportSections() {
      if (this.tagIds) {
        return this.tagIds.map(tagId => this.tags.find(t => t.id === tagId));
      } else {
        return [];
      }
    },
    reportItems() {
      let reportItems = [];
      if (this.reportSections) {
        this.reportSections.forEach(r => {
          const annos = this.annotations.filter(a => a.tagId === r.id);
          reportItems.push(annos);
        });
      }

      return reportItems;
    },
    noteItems() {
      return this.comments.filter(c => c.annotationId === null);
    }
  },
  methods: {
    open() {
      this.$refs.modal.open();
    },
    showAnnotation(annoID) {
      this.eventBus.emit("sidebarScroll", annoID);
      this.eventBus.emit('pdfScroll', annoID);
      this.$refs.modal.close();
    },
    showComment(commId) {
      this.eventBus.emit("sidebarScroll", commId);
      this.eventBus.emit('pdfScroll', commId);
      this.$refs.modal.close();
    },
    decisionSubmit(decision) {
      this.$emit('decisionSubmit', decision);
      this.$refs.modal.close();
    }
  }
}
</script>

<style scoped>

</style>