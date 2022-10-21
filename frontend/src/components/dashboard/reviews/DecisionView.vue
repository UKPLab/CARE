<template>
  <Modal ref="decisionView" lg decision:decision decisionReason:decisionReason>
    <template v-slot:title>View Acceptance Decision</template>
    <template v-slot:body>
      <h1>{{ decision ? "Accepted" : "Rejected" }}</h1>
      <p>{{ decisionReason }}</p>
    </template>
    <template v-slot:footer>
    </template>
  </Modal>
</template>

<script>
/* DecisionView.vue - modal for acceptance decision

Modal to accept or reject the paper review

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/
import Modal from "../../basic/Modal.vue";
import {mapGetters} from "vuex";

export default {
  name: "DecisionView",
  components: {Modal},
  props: {},
  data() {
    return {
      decision: null,
      decisionReason: null,
    }
  },
  mounted() {
    this.$socket.emit("getAllUserData");
  },
  methods: {
    ...mapGetters({items: 'admin/getUsers'}),

    open(review) {
      this.review = review;
      if (this.review.accepted !== null) {
        this.decision = this.review.accepted;
        this.decisionReason = this.review.decisionReason;
      }
      this.$refs.decisionView.openModal();
      this.$socket.emit("stats", {action: "openModalDecisionView", data: {}});
    }
  }
}
</script>

<style scoped>

</style>