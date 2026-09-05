<template>
  <DashboardListPage
      :title="$t('nlp.skills.title')"
      :columns="columns"
      :data="data"
      :buttons="buttons"
      :table-options="options"
      @action="action"
  >
    <template #headerActions>
      <span v-if="!waitForStatus" class="badge" :class="onlineStatus? 'bg-success' : 'bg-danger'">
        {{ onlineStatus ? $t('nlp.skills.status.online') : $t('nlp.skills.status.offline') }}
      </span>
      <div v-else class="spinner-grow" role="status" style="width:12px; height:12px">
        <span class="visually-hidden">{{ $t('common.loading') }}</span>
      </div>
      <div class="btn-group gap-2 ms-3">
        <BasicButton
            class="btn-primary btn-sm"
            :title="$t('common.refresh')"
            :text="$t('common.refresh')"
            icon="arrow-clockwise"
            @click="load"
        />
      </div>
    </template>
  </DashboardListPage>
  <NlpSkillModal ref="nlpSkillModal"/>
</template>

<script>
import NlpSkillModal from "./nlp_skills/NlpSkillModal.vue";
import BasicButton from "@/basic/Button.vue";
import DashboardListPage from "@/basic/dashboard/ListPage.vue";
import { DEFAULT_DASHBOARD_TABLE_OPTIONS } from "@/basic/dashboard/constants.js";
import {cloneDeep} from "lodash";
import { dashboardRowAction } from "@/basic/dashboard/actions.js";
import { resolveApiMessage } from "@/assets/utils";

/**
 * Shows the list of available nlp skills to admins
 *
 * This component loads all available skills as registered at the NLP broker. Each skill
 * is presented in one row and allows to get the details on click in a modal.
 *
 * @author: Nils Dycke, Dennis Zyska
 */
export default {
  name: "NlpSkills",
  components: {DashboardListPage, BasicButton, NlpSkillModal},
  props: {
    'admin': {
      type: Boolean,
      required: false,
      default: false
    },
  },
  data() {
    return {
      options: {...DEFAULT_DASHBOARD_TABLE_OPTIONS},
      waitForStatus: true,
      onlineStatus: false
    }
  },
  computed: {
    columns() {
      return [
        {name: this.$t('common.name'), key: "name"},
        {name: this.$t('nlp.skills.columns.nodes'), key: "nodes"},
        {
          name: this.$t('nlp.skills.columns.activated'),
          key: "activated",
          type: "toggle",
        },
        {
          name: this.$t('nlp.skills.columns.fallback'),
          key: "fallback",
          type: "badge",
          typeOptions: {
            keyMapping: {true: this.$t('common.yes'), default: this.$t('common.no')},
            classMapping: {true: "bg-success", default: "bg-danger"}
          },
        },
        {name: this.$t('common.actions'), key: "actions", type: "button-group"},
      ];
    },
    buttons() {
      return [
        dashboardRowAction("settings", {
          title: this.$t('common.configure'),
          action: "configure",
        }),
      ];
    },
    data() {
      const skills = this.$store.getters["service/get"]("NLPService", "skillUpdate");

      return skills ? Object.values(skills).map(s => {
        s = cloneDeep(s);
        // check for relevant settings
        const activeStatus = this.$store.getters["settings/getValue"](`annotator.nlp.${s.name}.activated`);
        s.activated = {
          title: this.$t('nlp.skills.status.activating'),
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
      switch (data.action) {
        case "configure":
          this.getDetails(data.params);
          break;
        case "toggleActiveStatus":
          this.changeSkillActiveStatus(data.params, data.value);
          break;
      }
    },
    changeSkillActiveStatus(skill_row, newActiveState) {
      this.$socket.emit("settingSave", [{
            key: `annotator.nlp.${skill_row.name}.activated`,
            value: newActiveState
          }], (res) => {
            if (res.success) {
              this.eventBus.emit("toast", {
                title: this.$t('nlp.skills.toasts.settingUpdatedTitle'),
                message: this.$t('nlp.skills.toasts.settingUpdatedMessage', { name: skill_row.name }),
                variant: "success",
              });
            } else {
              this.eventBus.emit("toast", {
                title: this.$t('nlp.skills.toasts.updateFailedTitle'),
                message: resolveApiMessage(res),
                variant: "danger",
              });
            }
          }
      );
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