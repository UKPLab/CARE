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
/* NlpSkillModal.vue - modal for details on a given NLP Skill

Author: Nils Dycke (dycke@ukp...)
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
  watch: {
    config(newVal, oldVal) {
      if(newVal.length > 0){
        this.loading = false;
      }
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
        const stored = this.$store.getters['nlp/getSkillConfig'](this.skillName);
        if(stored !== null){
          return JSON.stringify(stored, null, 2);
        }
      }
      return "";
    }
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