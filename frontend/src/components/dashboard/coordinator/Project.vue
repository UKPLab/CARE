<template>
  <BasicCoordinator
    ref="coordinator"
    table="project"
    :title="$t('dashboard.projects.coordinator.title')"
  />
</template>

<script>
import BasicCoordinator from "@/basic/dashboard/Coordinator.vue";
import { translateMaybeKey } from "@/assets/utils";

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
      this.$refs.coordinator.open(projectId, defaultValues);
    },
    copy(projectId, defaultValues = {}) {
      const overrides = {};
      if (projectId) {
        const project = this.$store.getters["table/project/get"](projectId);
        if (project?.userId === null) {
          // For seed projects (e.g. default project), prefill copy form with localized text.
          overrides.name = translateMaybeKey(project.name);
          overrides.description = translateMaybeKey(project.description);
        }
      }
      this.$refs.coordinator.open(projectId, defaultValues, true, overrides);
    },
    close() {
      this.$refs.coordinator.close();
    },
  },
};
</script>

<style scoped>

</style>