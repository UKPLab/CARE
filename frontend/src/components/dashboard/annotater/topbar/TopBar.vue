<template>
  <nav id="top-navbar" class="navbar fixed-top navbar-expand-lg navbar-light bg-light">
    <div id="top-container" class="container-fluid">
      <button class="btn" href @click="this.$router.push('/')" title="Go back...">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-left" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
        </svg>
      </button>
      <a class="navbar-brand" href @click="this.$router.push('/')" >PEER</a>
      <div id="navbarSupportedContent" class="collapse navbar-collapse">
        <form class="container-fluid justify-content-center">
             <button v-if="review" class="btn btn-outline-success me-2" type="button" v-on:click="this.$refs.reviewSubmit.open()">Submit Review</button>
             <button v-if="approve" class="btn btn-outline-dark me-2" type="button" v-on:click="this.$refs.report.open()">Report</button>
             <button v-if="approve" class="btn btn-outline-success me-2" type="button" v-on:click="decisionSubmit(true)">Accept</button>
             <button v-if="approve" class="btn btn-outline-danger me-2" type="button" v-on:click="decisionSubmit(false)">Reject</button>
             <button class="btn btn-outline-secondary" type="button" @click="downloadAnnotations()">Download Annotations</button>
        </form>
        <ul class="navbar-nav ms-auto mb-2 mb-lg-0">
          <li class="nav-item">
          </li>
        </ul>
      </div>
      <!-- check for additional fields: https://getbootstrap.com/docs/5.0/components/navbar/ -->
    </div>
  </nav>

  <ReviewSubmit v-if="review" ref="reviewSubmit" :review_id="review_id" :document_id="document_id" ></ReviewSubmit>
  <Report v-if="approve" ref="report" :review_id="review_id" :document_id="document_id" @decisionSubmit="decisionSubmit"></Report>
  <DecisionSubmit v-if="approve" ref="decisionSubmit" :review_id="review_id" :document_id="document_id"></DecisionSubmit>

</template>

<script>

import ReviewSubmit from "../../modals/ReviewSubmit.vue";
import Report from "../../modals/Report.vue";
import DecisionSubmit from "../../modals/DecisionSubmit.vue";
import {toCSV} from "../../../../data/annotation";
import {FileSaver} from "file-saver"; //required for window.saveAs to work

export default {
  name: "TopBar",
  components: {DecisionSubmit, Report, ReviewSubmit},
  props: {
    document_id: {
      type: String,
      required: true
    },
    'review_id': {
     type: String,
      required: false,
      default: null
    },
    readonly: {
      type: Boolean,
      required: false,
      default: false,
    },
    approve: {
      type: Boolean,
      required: false,
      default: false,
    },
    review: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  methods: {
    decisionSubmit(decision){
      this.$refs.decisionSubmit.open(decision);
    },
    async downloadAnnotations(){
      // for now: fetch the annotations from store -- later we could move this to the sidebar for what you see is what
      // you get behavior
      const annos = this.$store.getters["anno/getAnnotations"](this.document_id);
      const csv = toCSV(annos, ["id", "document_id", "user", "anchors", "text", "tags"],
                            ["id", "text"])

      const csvStr = await csv.toString(true, true);

      window.saveAs(new Blob([csvStr], {type: "text/csv;charset=utf-8"}), "annotations.csv");
    }
  }
}
</script>

<style scoped>

#top-navbar {
  width: 100%;
  position: absolute;
}

#top-container {
  padding-left: 10px;
  padding-right: 5px;
}
</style>