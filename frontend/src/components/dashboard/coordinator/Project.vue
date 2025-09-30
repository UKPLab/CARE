<template>
  <BasicCoordinator
    ref="coordinator"
    table="project"
    title="Project"
  />
</template>

<script>
import BasicCoordinator from "@/components/dashboard/Coordinator.vue";

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
    }
  },
  methods: {
    open(projectId, defaultValues = {}) {
      this.$refs.coordinator.open(projectId, defaultValues);
    },
    copy(projectId, defaultValues = {}) {
      this.$refs.coordinator.open(projectId, defaultValues, true);
    },
    close() {
      this.$refs.coordinator.close();
    }
  }
}
</script>

<style scoped>

</style>