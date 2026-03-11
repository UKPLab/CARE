<template>
  <FormElement v-if="'nodes' in currentData" ref="formElement" :data-table="dataTable" :options="options">
    <template #element>
      <div class="card border-1 text-start rounded-0 w-100">
        <div class="d-flex justify-content-between align-items-center p-1 card-header">
          <span class="text-start">
            <!-- Always visible: inspect and copy -->
            <BasicButton
              class="btn border-0"
              icon="info-circle"
              tooltip="Inspect node"
              :disabled="!activateEditNode"
              @click="inspectNode(selectedNodes[0])"
            />
            <BasicButton
              class="btn border-0"
              icon="copy"
              tooltip="Copy node"
              :disabled="!activateEditNode"
              @click="copyNode(selectedNodes[0])"
            />
            <!-- Edit mode buttons -->
            <template v-if="editable">
              <BasicButton
                class="btn border-0"
                :rotate-icon="180"
                icon="node-plus"
                tooltip="Add node before"
                :disabled="!activateAddNode"
                @click="addNodePrevious(selectedNodes[0])"
              />
              <BasicButton
                class="btn border-0"
                :disabled="!activateAddNode"
                icon="node-plus"
                tooltip="Add node after"
                @click="addNodeAfter(selectedNodes[0])"
              />
              <BasicButton
                class="btn border-0"
                icon="dash-circle"
                tooltip="Remove node"
                :disabled="!activateRemoveNode"
                @click="removeNode(selectedNodes[0])"
              />
              <BasicButton
                class="btn border-0"
                icon="pencil"
                tooltip="Edit node"
                :disabled="!activateEditNode"
                @click="editNode(selectedNodes[0])"
              />
              <div class="position-relative d-inline-block" v-if="activatePasteNode">
                <BasicButton
                  class="btn border-0"
                  :disabled="!activatePasteNode"
                  icon="clipboard"
                  tooltip="Paste copied node"
                  @click="togglePasteOptions"
                />
                <!-- Paste Options Modal -->
                <div v-if="showPasteOptions" class="paste-options-modal">
                  <BasicButton
                    class="btn border-0"
                    :rotate-icon="180"
                    icon="node-plus"
                    tooltip="Paste before selected node"
                    @click="pasteNodeBefore(selectedNodes[0])"
                  />
                  <BasicButton
                    class="btn border-0"
                    icon="node-plus"
                    tooltip="Paste after selected node"
                    @click="pasteNodeAfter(selectedNodes[0])"
                  />
                </div>
              </div>
            </template>
            <!-- Readonly indicator -->
            <span v-else class="badge text-bg-secondary ms-1 align-middle d-inline-flex align-items-center gap-1">
              <BasicIcon icon-name="lock-fill" :size="12" color="#fff" />
              You cannot edit this graph
            </span>
          </span>
        </div>
        <div class="card-body">
          <v-network-graph ref="graph" v-model:selected-nodes="selectedNodes" class="graph"
            :nodes="currentData['nodes']" :edges="currentData['edges']" :configs="configs"
            :layouts="currentData['layouts']" />
        </div>
      </div>
    </template>
  </FormElement>
  <teleport to="body">
    <slot name="nodeEditor"></slot>
    <ConfirmModal ref="confirmDeletion" />
  </teleport>
</template>

<script>
import FormElement from "@/basic/form/Element.vue"
import { VNetworkGraph } from "v-network-graph";
import * as vNG from "v-network-graph";
import BasicIcon from "@/basic/Icon.vue";
import BasicButton from "@/basic/Button.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import dagre from "dagre";
import deepEqual from "deep-equal";

const nodeSize = 40;

/**
 * Basic Graph Editor
 *
 * Opens a new coordinator modal to edit a graph
 * Currently only supports linear directed graphs
 *
 * @author: Dennis Zyska, Karim Ouf
 * 
 */
export default {
  name: "FormGraph",
  components: {
    BasicIcon, BasicButton, FormElement, VNetworkGraph, ConfirmModal,
  },
  inject: {
    mainModal: {
      default: null
    },
    plugin: {
      default: null
    }
  },
  props: {
    nodeContextMap: {
      type: Array,
      required: false,
      default: () => ([]),
    },
    options: {
      type: Object,
      required: true,
    },
    modelValue: {
      type: Object,
      required: false,
      default: () => {
        return {}
      }
    },
    copiedNodeData: {
      type: Object,
      required: false,
      default: null,
    },
    dataTable: {
      type: Boolean,
      required: false,
      default: false,
    },
    editable: {
      type: Boolean,
      required: false,
      default: true,
    }
  },
  emits: ["update:node", "delete:node", "add:nodeAfter", "add:nodePrevious", "copy:node", "paste:nodeBefore", "paste:nodeAfter", "inspect:node"],
  data() {
    return {
      selectedNodes: [],
      currentData: {},
      currentEditingNodeId: null,
      currentNodeTable: null,
      editorRef: null,
      showPasteOptions: false,
      configs: vNG.defineConfigs({
        node: {
          selectable: 1,
          draggable: false,
          normal: { radius: nodeSize / 2 },
        },
        edge: {
          marker: {
            target: {
              type: 'arrow',
              width: 4,
              height: 4,
            }
          }
        },
        view: {
          //layoutHandler: new vNG.GridLayout({grid: 15}),
          autoPanAndZoomOnLoad: "fit-content",
          autoPanOnResize: true,
          // onBeforeInitialDisplay: () => this.layout("LR"),
          panEnabled: false,
          zoomEnabled: false,
        },
      })
    }
  },
  computed: {
    activateAddNode() {
      // linear directed graph could only be extended at the end
      return Object.keys(this.currentData['nodes']).length === 0 || this.selectedLastNode;
    },
    selectedLastNode() {
      // the last node has no outgoing edges
      return this.selectedNodes.length === 1 && Object.values(this.currentData['edges']).filter(e => e.source === this.selectedNodes[0]).length === 0;
    },
    activateRemoveNode() {
      return this.selectedNodes.length > 0;
    },
    activateEditNode() {
      return this.selectedNodes.length === 1;
    },
    activatePasteNode() {
      return this.copiedNodeData && this.selectedNodes.length === 1;
    },
  },
  watch: {
    modelValue: {
      handler() {
        if(deepEqual(this.modelValue, this.currentData)) {
          return;
        }
        this.setCurrentData(this.modelValue);
        this.updateLayout("LR");
      },
      deep: true
    },
    selectedNodes: {
      handler() {
        this.showPasteOptions = false;
      }
    }

  },
  mounted() {
    this.setCurrentData(this.modelValue);
    this.$nextTick(() => {
      this.updateLayout("LR");
    });
  },
  methods: {
    setCurrentData(modelValue) {
      if (!('nodes' in modelValue)) {
        modelValue['nodes'] = {};
      }
      if (!('edges' in modelValue)) {
        modelValue['edges'] = {};
      }
      if (!('layouts' in modelValue)) {
        modelValue['layouts'] = {};
      }
      if (!('nodes' in modelValue['layouts'])) {
        modelValue['layouts']['nodes'] = {};
      }   
      this.currentData = modelValue;
    },
    /**
     * Layout graph
     * @param direction - TB or LR
     */
    layout(direction) {
      // if (Object.keys(this.currentData['nodes']).length <= 1 || Object.keys(this.currentData['edges']).length === 0) {
      //   return
      // }


      // convert graph
      // ref: https://github.com/dagrejs/dagre/wiki
      const g = new dagre.graphlib.Graph()
      // Set an object for the graph label
      g.setGraph({
        rankdir: direction,
        nodesep: nodeSize * 2,
        edgesep: nodeSize,
        ranksep: nodeSize * 2,
      })
      // Default to assigning a new object as a label for each new edge.
      g.setDefaultEdgeLabel(() => ({}))

      // Add nodes to the graph. The first argument is the node id. The second is
      // metadata about the node. In this case we're going to add labels to each of
      // our nodes.
      Object.entries(this.currentData['nodes'])
        .filter(([nodeId, node]) => node && !node.deleted)
        .forEach(([nodeId, node]) => {
          g.setNode(nodeId, { label: node.name, width: nodeSize, height: nodeSize })
        })

      // Add edges to the graph.
      Object.values(this.currentData['edges']).forEach(edge => {
        g.setEdge(edge.source, edge.target)
      })

      dagre.layout(g)
      g.nodes().forEach((nodeId) => {
        if (g.node(nodeId) === undefined) return;
        // update node position
        const x = g.node(nodeId).x
        const y = g.node(nodeId).y
        this.currentData['layouts']['nodes'][nodeId] = { x, y }
      })

      // fit after timeout to avoid bug
      setTimeout(() => {
        this.$refs['graph']?.fitToContents();
      }, 500);
    },
    updateLayout(direction) {
      this.$refs['graph']?.transitionWhile(() => {
        this.layout(direction);
      });
    },
    addNodeAfter(node) {
      this.$emit("add:nodeAfter", node);
    },
    addNodePrevious(node) {
      this.$emit("add:nodePrevious", node);
    },
    editNode(id) {
      this.$emit("update:node", id);
    },
    inspectNode(id) {
      this.$emit("inspect:node", id);
    },
    copyNode(id) {
      this.$emit("copy:node", id);
    },
    togglePasteOptions() {
      this.showPasteOptions = !this.showPasteOptions;
    },
    pasteNodeBefore(id) {
      this.showPasteOptions = false;
      this.$emit("add:nodePrevious", id, this.copiedNodeData);
    },
    pasteNodeAfter(id) {
      this.showPasteOptions = false;
      this.$emit("add:nodeAfter", id, this.copiedNodeData);
    },  
    deleteSubNodes(nodeId) {
      const node = Number(nodeId)
      Object.entries(this.currentData['edges']).forEach(([edgeId, edge]) => {
        if (edge.target === node) {
          delete this.currentData['edges'][edgeId];
        }
        if (edge.source === node) {
          this.deleteSubNodes(edge.target);
          delete this.currentData['edges'][edgeId];
        }
      });
      // remove node
      delete this.currentData['nodes'][nodeId]
      if (this.currentData['layouts']?.nodes) {
        delete this.currentData['layouts']['nodes'][nodeId];
      }
      this.$emit("delete:node", nodeId, this.currentData);
    },
    removeNode(nodeId) {
      // warning that all subsequent nodes are also removed!
      this.mainModal?.hide();
      this.$refs['confirmDeletion'].open(
        "Remove Node",
        "Do you really want to remove the selected node?",
        "All subsequent nodes will also be removed!",
        (res) => {
          if (res) {
            this.deleteSubNodes(nodeId);
            this.selectedNodes = [];
            this.updateLayout("LR");  
          }
          this.mainModal?.show();
        }
      );
    },
    getTableForNode(type) {
      const target = this.options['nodes'][type]['target']
      if (target.startsWith('@')) {
        return ["plugin", this.plugin['uname'], target.substring(1)].join("_");
      } else {
        return target
      }
    },
  }
}
</script>

<style scoped>
.graph {
  width: 100%;
  height: 300px;
}

.rotate-180 {
  transform: scale(-1, -1);
  
}

.paste-options-modal {
  position: absolute;
  top: 100%;
  left: -75%;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
  padding: 0.5rem;
  z-index: 1000;
  display: flex;
  gap: 0.25rem;
  margin-top: 0.25rem;
}
</style>
