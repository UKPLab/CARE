<template>
  <Modal ref="nlpSkillModal" lg>
    <template v-slot:title>
      Details on {{this.skillName}}
    </template>
    <template v-slot:body>
      <div class="modal-body justify-content-center">
        <div v-if="loading" class="spinner-border m-5 " role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <div v-else>
          <pre>
            <code>
            {{this.config}}
            </code>
          </pre>
        </div>
      </div>
    </template>
    <template v-slot:footer>
      <button class="btn btn-secondary" data-bs-dismiss="modal" type="button">Close</button>
    </template>
  </Modal>
</template>

<script>
/* Upload.vue - modal for document upload component

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/
import Modal from "../../basic/Modal.vue";

export default {
  name: "NlpSkillModal",
  components: {Modal},
  data() {
    return {
      loading: true,
      show: false,
      skillName: null
    }
  },
  mounted() {
  },
  sockets: {
    nlp_skillConfig: function (data) {
      this.loading = false;
    }
  },
  computed: {
    config(){
      if(this.skillName !== null){
        const stored = this.$store.getters['nlp/getSkillConfig'](this.skillName);
        if(stored !== null){
          return JSON.stringify(stored, null, 2);
        }
      }
      return "";
    }
  },
  methods: {
    openModal(skillName) {
      this.skillName = skillName;

      this.$refs.nlpSkillModal.openModal();

      if(this.config.length === 0) {
        this.$socket.emit("nlp_skillGetConfig", {name: this.skillName});
      }
    }
  },

}
</script>

<style scoped>
pre {
    overflow-x: auto;
}
pre code {
    overflow-wrap: normal;
    white-space: pre;
}
</style>