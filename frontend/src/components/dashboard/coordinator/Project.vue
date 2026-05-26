<template>
  <BasicCoordinator
    ref="coordinator"
    table="project"
    :title="$t('dashboard.projects.coordinator.title')"
  />
</template>

<script>
import BasicCoordinator from "@/basic/dashboard/Coordinator.vue";

/**
 * ProjectModal - modal component for adding and editing projects
 *
 * @author Dennis Zyska
 */
export default {
  name: "CoordinatorProject",
  components: {BasicCoordinator},
  data() {
    return {
      projectId: 0,
    };
  },
  methods: {
    open(projectId, defaultValues = {}) {
      this.openCoordinator(projectId, defaultValues, false);
    },
    copy(projectId, defaultValues = {}) {
      this.openCoordinator(projectId, defaultValues, true);
    },
    openCoordinator(projectId, defaultValues, copy) {
      const overrides = {};
      const project = projectId
        ? this.$store.getters["table/project/get"](projectId)
        : null;
      if (project?.name === "Default Project") {
        overrides.name = this.$t("dashboard.projects.default.name");
        overrides.description = this.$t("dashboard.projects.default.description");
      }
      this.$refs.coordinator.open(projectId, defaultValues, copy, overrides);
    },
    close() {
      this.$refs.coordinator.close();
    },
  },
};
</script>

<style scoped>

</style>