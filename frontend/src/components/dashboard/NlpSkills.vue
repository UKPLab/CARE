<template>
  <Card title="Skills">
    <template v-slot:headerElements>
      <button class="btn btn-sm me-1" type="button" @click="load()" title="Refresh">
        <LoadIcon iconName="arrow-clockwise" @click=""></LoadIcon>
      </button>
    </template>
    <template v-slot:body>
      <Table :columns="columns" :data="data" :options="options"></Table>
    </template>
  </Card>
  <NlpSkillModal ref="nlpSkillModal"></NlpSkillModal>
</template>

<script>
/* NLPSkills.vue - shows the list of available nlp skills to admins

This component loads all available skills as registered at the NLP broker. Each skill
is presented in one row and allows to get the details on click in a modal.

Author: Nils Dycke (dycke@ukp...)
Source: -
*/

import LoadIcon from "@/icons/LoadIcon.vue";
import NlpSkillModal from "./nlp_skills/NlpSkillModal.vue";
import Table from "@/basic/table/Table.vue"
import Card from "@/basic/Card.vue"

export default {
  name: "NlpSkills",
  components: {Table, Card, NlpSkillModal, LoadIcon},
  data() {
    return {
      options: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
      },
      columns: [
        {name: "Name", key: "name"},
        {name: "# Nodes", key: "nodes"},
        {name: "Details", key: "details", type: "button"},
      ],
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
    data() {
      return this.$store.getters["nlp/getAllSkills"]().map(s => {
        s.details = {
          icon: "search-heart",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-secondary": true,
            }
          },
          title: "Show config...",
          onClick: this.getDetails,
        };
        return s;
      });
    },
  },
  methods: {
    load() {
      this.$socket.emit("nlp_skillGetAll");
    },
    getDetails(skill_row) {
      this.$refs["nlpSkillModal"].openModal(skill_row["name"]);
    },
  }
}
</script>

<style scoped>
</style>