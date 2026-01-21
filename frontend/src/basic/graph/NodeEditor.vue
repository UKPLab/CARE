<template>
    <BasicCoordinator
      ref="coordinator"
      table="workflow_step"
      title="Workflow Step"
      @success="success"
    >
      <template #success>
        The workflow step has been successfully saved.
      </template>
    </BasicCoordinator>
</template>

<script>
import BasicCoordinator from "@/basic/dashboard/Coordinator.vue";

/**
 * Basic Node Editor
 *
 * Opens a coordinator modal to edit a workflow step node in the graph
 *
 * @author: Dennis Zyska
 */
export default {
  name: "BasicNodeEditor",
  components: { BasicCoordinator },
  subscribeTable: ["workflow_step"],
  emits: ["update:node"],
  data() {
    return {
      currentNodeId: 0,
      isSuccess: false,
    };
  },

  methods: {
    open(nodeId, context = {}) {
      this.currentNodeId = nodeId || 0;
      this.isSuccess = false;
      console.log("Opening node editor for node ID:", this.currentNodeId, "with context:", context);
      this.$refs.coordinator.open(this.currentNodeId, context);
    },
    success(id) {
      this.currentNodeId = id;
      this.isSuccess = true;
      this.$emit('update:node', id);
    },
    close() {
      this.$refs.coordinator.close();
    },
  }
}
</script>

<style scoped>

</style>
