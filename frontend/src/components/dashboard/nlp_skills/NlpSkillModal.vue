<template>
  <Modal
    ref="nlpSkillModal"
    lg
    name="nlpSkills"
  >
    <template #title>
      Details on {{ skillName }}
    </template>
    <template #body>
      <div class="modal-body justify-content-center">
        <div
          v-if="loading"
          class="spinner-border m-5 "
          role="status"
        >
          <span class="visually-hidden">Loading...</span>
        </div>
        <div v-else>
          <pre>
            <code>
            {{ config }}
            </code>
          </pre>
        </div>
      </div>
    </template>
    <template #footer>
      <button
        class="btn btn-secondary"
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

/* NlpSkillModal.vue - modal for details on a given NLP Skill

Author: Nils Dycke (dycke@ukp...)
Source: -
*/
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
  computed: {
    /**
     * Returns the associated skill description based on the vuex stored information. The skill
     * description is simply shown as a JSON string.
     *
     * @returns {string} the JSON string to be shown
     */
    config(){
      if(this.skillName !== null){
        const stored = this.$store.getters["service/get"]("NLPService", "skillConfig");
        if(stored && this.skillName in stored){
          return JSON.stringify(stored[this.skillName], null, 2);
        }
      }
      return "";
    }
  },
  watch: {
    config(newVal, oldVal) {
      if(newVal.length > 0){
        this.loading = false;
      }
    }
  },
  mounted() {
  },
  methods: {
    /**
     * Opens the modal and triggers (if necessary) a request to the server to get the config for a skill.
     *
     * @param skillName, the name of the skill as advertised by a model
     */
    openModal(skillName) {
      this.skillName = skillName;

      this.$refs.nlpSkillModal.openModal();

      if(this.config.length === 0) {
        this.$socket.emit("serviceCommand", {service: "NLPService", command: "skillGetConfig", data: {name: this.skillName}});
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