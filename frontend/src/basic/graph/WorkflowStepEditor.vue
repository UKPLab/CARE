<template>
  <BasicCoordinator ref="coordinator" table="workflow_step" title="Workflow Step" no-success-message @success="success" />
</template>

<script>
import BasicCoordinator from "@/basic/dashboard/Coordinator.vue";

/**
 * Basic Node Editor
 *
 * Opens a coordinator modal to edit a workflow step node in the graph
 *
 * @author: Karim Ouf
 */
export default {
  name: "WorkflowStepEditor",
  components: { BasicCoordinator },
  subscribeTable: ["workflow_step"],
  emits: ["update:node"],
  data() {
    return {
      currentNodeId: 0,
      isSuccess: false,
      selectedNodeData: null,
    };
  },

  methods: {  
    open(nodeId, context = {}, nextNode=null) {
      this.selectedNodeData = nextNode || null;
      this.currentNodeId = nodeId || 0;
      this.isSuccess = false;
      this.$refs.coordinator.open(this.currentNodeId, context);
    },
    success(id, action) {
      this.currentNodeId = id;
      this.isSuccess = true;
      if (action === 'create') {
        if(this.selectedNodeData) {
          this.addNode(id)
        }else{
          this.$emit('update:node', id);
        }
       
      }else if(action === 'update'){
        this.$emit('update:node', id);
      }
    },
    close() {
      this.$refs.coordinator.close();
    },
    addNode(id) {
        this.$socket.emit(
          "appDataUpdate",
          {
            table: "workflow_step",
            data: {
              id: this.selectedNodeData.id,
              workflowStepPrevious: Number(id),  
              name: this.selectedNodeData.name || "",
              stepType: this.selectedNodeData.stepType,
            },
          },
          (response) => {
            if (response.success) {
              this.$emit("update:node", id);
            } else {
              this.eventBus.emit(
                "notification",
                "Error adding next node: " + response.error,
                "error"
              );
            }
          }
        );
    }
  }
}
</script>

<style scoped></style>
