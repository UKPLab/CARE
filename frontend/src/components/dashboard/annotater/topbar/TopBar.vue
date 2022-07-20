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

  <Modal ref="submit">
    <template v-slot:title>Test</template>
    <template v-slot:body>Thank you!</template>
    <template v-slot:footer>
      <button class="btn btn-secondary" data-bs-dismiss="modal" type="button" @click="submit">Back to Overview</button>
      <button class="btn btn-primary" type="button" @click="cancel">Cancel</button>
    </template>
  </Modal>
</template>

<script>
import Modal from "../Modal.vue";
export default {
  name: "TopBar",
  components: {Modal},
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
      this.$refs.submit.openModal();
    },
    cancel() {
      this.$refs.submit.closeModal();
    },
    submit() {
      this.$refs.submit.closeModal();
      this.$router.push("/");
      //TODO flag database, bot triggern, overlay

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