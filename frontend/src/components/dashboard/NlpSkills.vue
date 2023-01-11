<template>
  <div class="card">
    <div class="card-header d-flex justify-content-between align-items-center">
      <span>Skills</span>

      <div>
        <button class="btn btn-sm btn-secondary me-1" type="button" @click="load()" title="Refresh">
          <IconBoostrap name="arrow-clockwise"/>
        </button>
      </div>
    </div>
    <div class="card-body">
      <span v-if="items.length === 0">
        No skills available...
      </span>
      <table v-else class="table table-hover">
        <thead>
        <tr>
          <th v-for="field in fields" scope="col">{{ field.name }}</th>
          <th scope="col">Manage</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="item in items" :key="item.name">
          <td v-for="field in fields">{{ item[field.col] }}</td>
          <td>
            <button class="btn btn-outline-secondary" data-placement="top" data-toggle="tooltip"
                      title="Details..." type="button" @click="getDetails(item.name)">
                <IconBoostrap name="search-heart"></IconBoostrap>
                <span class="visually-hidden">Details</span>
              </button>
          </td>
        </tr>
        </tbody>
      </table>
    </div>
  </div>

  <NlpSkillModal ref="nlpSkillModal"></NlpSkillModal>
</template>

<script>
/* NLPSkills.vue - shows the list of available nlp skills to admins

This component loads all available skills as registered at the NLP broker. Each skill
is presented in one row and allows to get the details on click in a modal.

Author: Nils Dycke (dycke@ukp...)
Source: -
*/

import IconBoostrap from "../../icons/IconBootstrap.vue";
import NlpSkillModal from "./nlp_skills/NlpSkillModal.vue";

export default {
  name: "NlpSkills",
  components: {NlpSkillModal, IconBoostrap},
  data() {
    return {
      fields: [
        {name: "Name", col: "name"},
        {name: "# Nodes", col: "nodes"}
      ]
    }
  },
  props: {
    'admin': {
      required: false,
      default: false
    },
  },
  mounted() {
    this.load();
  },
  computed: {
    items() {
      return this.$store.getters["nlp/getAllSkills"]();
    },
  },
  methods: {
    load() {
      this.$socket.emit("nlp_skillGetAll");
    },
    getDetails(skill_name) {
      this.$refs["nlpSkillModal"].openModal(skill_name);
    }
  }
}
</script>

<style scoped>
</style>