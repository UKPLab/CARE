<template>
  <Card title="Skills">
    <template #headerElements>
      <ButtonHeader
        class="btn btn-sm me-1"
        title="Refresh"
        icon="arrow-clockwise"
        @click="load()"
      />
    </template>
    <template #body>
      <BasicTable
        :columns="columns"
        :data="data"
        :options="options"
        @action="action"
      />
    </template>
  </Card>
  <NlpSkillModal ref="nlpSkillModal" />
</template>

<script>
import NlpSkillModal from "./nlp_skills/NlpSkillModal.vue";
import BasicTable from "@/basic/table/Table.vue"
import Card from "@/basic/Card.vue"
import ButtonHeader from "@/basic/card/ButtonHeader.vue"

/**
 * Shows the list of available nlp skills to admins
 *
 * This component loads all available skills as registered at the NLP broker. Each skill
 * is presented in one row and allows to get the details on click in a modal.
 *
 * @author: Nils Dycke
 */
export default {
  name: "NlpSkills",
  components: {BasicTable, Card, ButtonHeader, NlpSkillModal},
  props: {
    'admin': {
      type: Boolean,
      required: false,
      default: false
    },
  },
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
        {
          name: "Fallback",
          key: "fallback",
          type: "badge",
          typeOptions: {
            keyMapping: {true: "Yes", default: "No"},
            classMapping: {true: "bg-success", default: "bg-danger"}
          },
        },
        {name: "Details", key: "details", type: "button"},
      ],
    }
  },
  computed: {
    data() {
      const skills = this.$store.getters["service/get"]("NLPService", "skillUpdate");
      return skills ? skills.map(s => {
        s.details = {
          icon: "search-heart",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-secondary": true,
            }
          },
          title: "Show config...",
          action: "getDetails",
        };
        return s;
      }) : [];
    },
  },
  mounted() {
    this.load();
  },
  methods: {
    action(data) {
      if (data.action === "getDetails") {
        this.getDetails(data.params);
      }
    },
    getDetails(skill_row) {
      this.$refs["nlpSkillModal"].openModal(skill_row["name"]);
    },
    load(){
      this.$socket.emit("serviceCommand", {service: "NLPService", command: "skillGetAll", data: {}});
    }
  }
}
</script>

<style scoped>
</style>