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
    <template v-slot:title>Submit your Review</template>
    <template v-slot:body>

      Are you sure about your final submission of the review?

    </template>
    <template v-slot:footer>
      <button class="btn btn-secondary" type="button" @click="cancel">No, not really...</button>
      <button class="btn btn-primary" type="button" @click="submit">Yes, Submit!</button>
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
      this.$refs.submit.waiting = true;
      this.sockets.subscribe("reviewSubmitted", (data) => {
        this.$refs.submit.closeModal();
        this.sockets.unsubscribe('reviewSubmitted');
        if (data.success) {
          this.eventBus.emit('toast', {title:"Review Submit", message:"Successful submitted the review!", variant: "success"});
          this.$router.push("/");
        } else {
          this.eventBus.emit('toast', {title:"Review Submit", message:"Error during submitting the review! Please try it again!", variant: "danger"});
        }
      });
      this.$socket.emit('reviewSubmit',
          {
            "document_id": this.document_id,
          });
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