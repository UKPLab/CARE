<template>
  <Modal ref="report" xl>
    <template v-slot:title>Review Report</template>
    <template v-slot:body>
      <p v-if="reportItems.length == 0">
        Report could not be generated.
      </p>
      <div v-for="s in Array(reportSections.length).keys()" :key="s">
        <h2>
          <span :class="`badge bg-${reportSections[s].colorCode}`">
             {{ reportSections[s].name }}
          </span>
        </h2>
        <ul v-if="reportItems.length > s">
          <li v-for="r in reportItems[s]" :key="r.id">
            <ReportItem :content="r" @showReportAnnotation="showAnnotation"></ReportItem>
          </li>
          <li v-if="reportItems[s].length === 0 ">
            No comments.
          </li>
        </ul>
        <p v-else>
          No comments.
        </p>
      </div>
      <p id="footnote">*Tip: Hover over a reference to see the referenced text or click to view the annotation in the
        PDF.</p>
    </template>
    <template v-slot:footer>
      <button class="btn btn-secondary" type="button" @click="cancel">Close</button>
      <button class="btn btn-outline-success me-2" type="button" v-on:click="decisionSubmit(true)">Accept</button>
      <button class="btn btn-outline-danger me-2" type="button" v-on:click="decisionSubmit(false)">Reject</button>
    </template>
  </Modal>
</template>

<script>
/* Report.vue - modal to show a report over comments/annotations

Author: Nils Dycke (dycke@ukp...)
Source: -
*/
import Modal from "../../basic/Modal.vue";
import ReportItem from "../ReportItem.vue";

export default {
  name: "Report",
  components: {Modal, ReportItem},
  data() {
    return {
      reportItems: [],
      reportSections: []
    }
  },
  props: {
    document_id: {
      type: String,
      required: true
    },
    'review_id': {
      type: String,
      required: true,
    },
  },
  mounted() {
  },
  watch: {
    annotations(newVal, oldVal) {
      this.gen_report();
    },
    tagSet(newVal, oldVal) {
      this.gen_report();
    }
  },
  computed: {
    annotations() {
      return this.$store.getters['anno/getAnnotations'](this.document_id);
    },
    tagSet() {
      return this.$store.getters["tag/getTags"];
    }
  },
  methods: {
    open() {
      this.$refs.report.openModal();
    },
    cancel() {
      this.$refs.report.closeModal();
    },
    gen_report() {
      //todo: for now simply generate the report in the frontend, later load it from the nlp server
      // add sections by tags
      this.reportSections = this.tagSet.filter(t => t.name !== "Highlight");

      // add annotations to sections
      this.reportItems = [];
      this.reportSections.forEach(r => {
        const tagName = r.name;
        const taggedAnnos = this.annotations.filter(a => a.tags.length > 0 && a.tags[0] === tagName);

        this.reportItems.push(taggedAnnos);
      });

      const untaggedAnnos = this.annotations.filter(a => a.tags.length === 0 || a.tags[0] === "");
      if (untaggedAnnos.length > 0) {
        this.reportSections.unshift({name: "General Remarks", colorCode: "secondary"})
        this.reportItems.unshift(untaggedAnnos);
      }

      //skip highlights for now...
      /*const htag = this.tagSet.find(t => t.name === "Highlight");
      if(htag !== undefined){
        this.reportSections.unshift({name: "Summary", colorCode: htag.colorCode});
        this.reportItems.unshift(this.annotations.filter(a => a.tags.length > 0 && a.tags[0] === "Highlight"));
      }*/
    },
    showAnnotation(annoID) {
      this.eventBus.emit("sidebarScroll", annoID);
      this.eventBus.emit('pdfScroll', annoID);
      this.cancel();
    },
    decisionSubmit(decision) {
      this.$emit('decisionSubmit', decision);
      this.cancel();
    }
  }
}
</script>

<style scoped>
#footnote {
  color: #4d4d4d;
  font-style: italic;
  font-size: small;
}
</style>