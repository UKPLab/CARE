<template>
  <nav id="top-navbar" class="navbar fixed-top navbar-expand-lg navbar-light bg-light">
    <div id="top-container" class="container-fluid">
      <a class="navbar-brand" href="/">PEER</a>
      <div id="navbarSupportedContent" class="collapse navbar-collapse">
        <form class="container-fluid justify-content-center">
             <button v-if="review" class="btn btn-outline-success me-2" type="button" v-on:click="confirmation">Submit Review</button>
             <button v-if="approve" class="btn btn-outline-success me-2" type="button">Report</button>
             <button v-if="approve" class="btn btn-outline-success me-2" type="button">Accept</button>
             <button v-if="approve" class="btn btn-outline-success me-2" type="button">Decline</button>
        </form>
        <ul class="navbar-nav ms-auto mb-2 mb-lg-0">
          <li class="nav-item">

          </li>
        </ul>
      </div>
      <!-- check for additional fields: https://getbootstrap.com/docs/5.0/components/navbar/ -->
    </div>
  </nav>

  <ReviewSubmit v-if="review" ref="reviewSubmit" :document_id="document_id" ></ReviewSubmit>

</template>

<script>

import ReviewSubmit from "../../modals/ReviewSubmit.vue";
export default {
  name: "TopBar",
  components: {ReviewSubmit},
  props: {
    document_id: {
      type: String,
      required: true
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
    confirmation() {
      this.$refs.reviewSubmit.open();
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