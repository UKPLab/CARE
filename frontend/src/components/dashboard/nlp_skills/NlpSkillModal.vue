<template>
  <Modal
    ref="nlpSkillModal"
    lg
    name="nlpSkills"
  >
    <template #title>
      Skill Details
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
          <SkillListing :config="config" />
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
import SkillListing from "./SkillListing.vue";

/* NlpSkillModal.vue - modal for details on a given NLP Skill

Author: Nils Dycke (dycke@ukp...)
Source: -
*/
export default {
  name: "NlpSkillModal",
  components: {SkillListing, Modal},
  data() {
    return {
      show: false,
      skillName: null
    }
  },
  computed: {
    /**
     * Returns the associated skill description based on the vuex stored information. The skill
     * description is simply shown as a JSON string.
     *
     * @returns {string|null} the JSON string to be shown
     */
    config() {
      if (this.skillName) {
        const stored = this.$store.getters["service/get"]("NLPService", "skillConfig");

        if (stored && this.skillName in stored) {
          return stored[this.skillName];
        }
      }
      return null;
    },
    /**
     * Indicates whether the modal is still loading the config; false if it was loaded successfully.
     * @returns {boolean}
     */
    loading() {
      return !this.config || this.config.length === 0;
    },

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

      if (!this.config || this.config.length === 0) {
        this.$socket.emit("serviceCommand", {
          service: "NLPService",
          command: "skillGetConfig",
          data: {name: this.skillName}
        });
      }
    },
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