<template>
  <nav id="top-navbar" class="navbar fixed-top navbar-expand-lg navbar-light bg-light">
    <div id="top-container" class="container-fluid">
      <a class="navbar-brand" href="/">PEER</a>
      <div id="navbarSupportedContent" class="collapse navbar-collapse">
        <form class="container-fluid justify-content-center">
             <button v-if="review" class="btn btn-outline-success me-2" type="button" v-on:click="this.$refs.reviewSubmit.open()">Submit Review</button>
             <button v-if="approve" class="btn btn-outline-dark me-2" type="button" v-on:click="this.$refs.report.open()">Report</button>
             <button v-if="approve" class="btn btn-outline-success me-2" type="button" v-on:click="this.$refs.decisionSubmit.open(true)">Accept</button>
             <button v-if="approve" class="btn btn-outline-danger me-2" type="button" v-on:click="this.$refs.decisionSubmit.open(false)">Reject</button>
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
  <Report v-if="approve" ref="report" :review_id="review_id" :document_id="document_id"></Report>
  <DecisionSubmit v-if="approve" ref="decisionSubmit" :review_id="review_id" :document_id="document_id"></DecisionSubmit>

</template>

<script>

import ReviewSubmit from "../../modals/ReviewSubmit.vue";
import Report from "../../modals/Report.vue";
import DecisionSubmit from "../../modals/DecisionSubmit.vue";
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