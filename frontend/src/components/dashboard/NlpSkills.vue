<template>
  <Card title="Skills">
    <template #headerElements>
      <span v-if="!waitForStatus" class="badge" :class="onlineStatus? 'bg-success' : 'bg-danger'">
        {{ onlineStatus ? "ONLINE" : "OFFLINE" }}
      </span>
      <div v-else class="spinner-grow" role="status" style="width:12px; height:12px">
        <span class="visually-hidden">Loading...</span>
      </div>
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
  <NlpSkillModal ref="nlpSkillModal"/>
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
          name: "Activated",
          key: "activated",
          type: "toggle",
        },
        {
          name: "Fallback",
          key: "fallback",
          type: "badge",
          typeOptions: {
            keyMapping: {true: "Yes", default: "No"},
            classMapping: {true: "bg-success", default: "bg-danger"}
          },
        },
        {name: "Actions", key: "actions", type: "button-group"},
      ],
      waitForStatus: true,
      onlineStatus: false
    }
  },
  computed: {
    data() {
      const skills = this.$store.getters["service/get"]("NLPService", "skillUpdate");

      return skills ? Object.values(skills).map(s => {
        s.actions = [{
          icon: "gear",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-secondary": true,
            }
          },
          title: "Configure",
          action: "configure",
        }];

        // check for relevant settings
        const activeStatus = this.$store.getters["settings/getValue"](`annotator.nlp.${s.name}.activated`);
        s.activated = {
          title: "Activating",
          value: activeStatus !== "false",
          action: "toggleActiveStatus"
        }

        return s;
      }) : [];
    },
    lastServiceUpdate() {
      return this.$store.getters["service/getStatus"]("NLPService");
    },
  },
  watch: {
    lastServiceUpdate(newVal) {
      if (newVal) {
        this.waitForStatus = false;
        this.onlineStatus = true;
      }
    }
  },
  mounted() {
    this.load();
    this.checkServiceConnection();
  },
  methods: {
    action(data) {
      switch(data.action) {
        case "configure":
          this.getDetails(data.params);
          break;
        case "toggleActiveStatus":
          this.changeSkillActiveStatus(data.params, data.value);
          break;
      }
    },
    changeSkillActiveStatus(skill_row, newActiveState) {
      console.log("Saving setting", skill_row, newActiveState);
      this.$socket.emit("settingSave", [{key: `annotator.nlp.${skill_row.name}.activated`, value: newActiveState}]);
    },
    getDetails(skill_row) {
      this.$refs["nlpSkillModal"].openModal(skill_row["name"]);
    },
    load() {
      this.$socket.emit("serviceCommand", {service: "NLPService", command: "skillGetAll", data: {}});
      this.checkServiceConnection();
    },
    checkServiceConnection() {
      this.$socket.emit("serviceCommand", {service: "NLPService", command: "getStatus", data: {}});
      this.waitForStatus = true;

      setTimeout(() => {
        if (this.waitForStatus) {
          this.waitForStatus = false;
          this.onlineStatus = false;
        }
      })
    }
  }
}
</script>

<style scoped>
</style>