<template>
  <TopBar v-if="!hideTopbar" />
  <Toast />
  <router-view class="top-padding" />
</template>

<script>
import Toast from "@/basic/Toast.vue";
import TopBar from "@/basic/Topbar.vue";
import createTables from "@/store/tables";

/**
 * Main App Component
 *
 * @author Dennis Zyska, Nils Dycke
 */
export default {
  name: "App",
  components: {TopBar, Toast},
  sockets: {
    logout: function () {
      this.$router.push("/login");
    },
    settingRefresh: function (data) {
      let tables = [{name: 'study', fields: [
        {
            key: "name",
            label: "Name of the study:",
            placeholder: "My user study",
            type: "text",
            required: true,
            default: "",
        },
        {
            key: "documentId",
            label: "Selected document for the study:",
            type: "select",
            options: {
                table: "document", name: "name", value: "id"
            },
            icon: "file-earmark",
            required: true,
        },
        {
            key: "description",
            label: "Description of the study:",
            help: "This text will be displayed at the beginning of the user study!",
            type: "editor",
        },
        {
            key: "timeLimit",
            type: "slider",
            label: "How much time does a participant have for the study?",
            help: "0 = disable time limitation",
            size: 12,
            unit: "min",
            min: 0,
            max: 180,
            step: 1,
            required: false,
            default: 0,
        },
        {
            key: "collab",
            label: "Should the study be collaborative?",
            type: "switch",
            required: true,
            default: false,
        },
        {
            key: "resumable",
            label: "Should the study be resumable?",
            type: "switch",
            required: true,
            default: false,
        },
        {
            key: "start",
            label: "Study sessions can't start before",
            type: "datetime",
            size: 6,
            required: true,
            default: null,
        },
        {
            key: "end",
            label: "Study sessions can't start after:",
            type: "datetime",
            size: 6,
            required: true,
        },
    ]}, {name: 'document', fields: []}];
      createTables(this.$store, tables);
    },
  },
  computed: {
    hideTopbar() {
      return this.$route.meta.hideTopbar !== undefined && this.$route.meta.hideTopbar;
    },
  },
  watch: {
    $route(to, from) {
      if (to.fullPath !== from.fullPath) {
        this.$socket.emit("stats", {action: "routeStep", data: {from: from.fullPath, to: to.fullPath}});
      }
    }
  },
  mounted() {
    this.$socket.emit("settingGetAll");
  },
}
</script>

<style>
.top-padding {
  padding-top: 52.5px;
}
</style>
