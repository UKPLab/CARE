<template>
  <FormElement v-if="'nodes' in currentData" ref="formElement" :data-table="dataTable" :options="options">
    <template #element>
      <div class="card border-1 text-start rounded-0 w-100">
        <span class="text-start p-1 card-header">
          <span class="dropdown">
            <button
              id="addNodeList"
              type="button"
              class="btn btn-sm border-0 dropdown-toggle"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              :disabled="!activateAddNode"
            >
              <BasicIcon
                icon-name="node-plus"
                :size="20"
                :color="activateAddNode ? 'blue': ''"
                class="mx-1"/>
            </button>
            <ul
              class="dropdown-menu"
              :class="activateAddNode ? 'hide': ''"
              aria-labelledby="addNodeList">
              <li
                v-for="d in Object.keys(options['nodes'])"
                :key="d">
                  <a
                    class="dropdown-item"
                    href="#"
                    @click="addNode(d)">
                    {{ options['nodes'][d]['label'] }}
                  </a>
                </li>
              </ul>
          </span>
          <button
            type="button"
            class="btn btn-sm border-0"
            :disabled="!activateRemoveNode">
            <BasicIcon
              icon-name="node-minus"
              :size="20"
              :color="activateRemoveNode ? 'blue': ''"
              class="mx-1"
              @click="removeNode()"/>
          </button>
          <button
            type="button"
            class="btn btn-sm border-0"
            :disabled="!activateEditNode">
            <BasicIcon
              icon-name="pencil"
              :size="18"
              :color="activateEditNode ? 'blue': ''"
              class="mx-1"
              @click="editNode(selectedNodes[0])"
            />
          </button>
        </span>
        <div class="card-body">
          <v-network-graph
            ref="graph"
            v-model:selected-nodes="selectedNodes"
            class="graph"
            :nodes="currentData['nodes']"
            :edges="currentData['edges']"
            :configs="configs"
            :layouts="currentData['layouts']"
          />
        </div>
      </div>
    </template>
  </FormElement>
  <teleport to="body">
    <NodeEditor
      v-for="n in Object.keys(options['nodes'])"
      :key="n"
      :ref="'nodeEditor_' + n"
      :table="getTableForNode(n)"
      table-namespace="plugins"
      @update:node="updateNode">
    </NodeEditor>
    <ConfirmModal ref="confirmDeletion"/>
  </teleport>
</template>

<script>
import FormElement from "@/basic/form/Element.vue"
import {VNetworkGraph} from "v-network-graph";
import * as vNG from "v-network-graph";
import BasicIcon from "@/basic/Icon.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import {defineAsyncComponent} from "vue";
import dagre from "dagre";

const nodeSize = 30;

/**
 * Basic Graph Editor
 *
 * Opens a new coordinator modal to edit a graph
 * Currently only supports linear directed graphs
 *
 * @author: Dennis Zyska
 */
export default {
  name: "FormGraph",
  components: {
    BasicIcon, FormElement, VNetworkGraph, ConfirmModal,
    // need async component to avoid circular dependency
    "NodeEditor": defineAsyncComponent(() => import('@/basic/form/graph/NodeEditor.vue'))
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
    dataTable: {
      type: Boolean,
      required: false,
      default: false,
    }
  },
  emits: ["update:modelValue"],
  data() {
    return {
      selectedNodes: [],
      currentData: {},
      configs: vNG.defineConfigs({
        node: {
          selectable: 1,
          draggable: false,
          normal: {radius: nodeSize / 2},
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
          onBeforeInitialDisplay: () => this.layout("LR"),
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
  },
  watch: {
    currentData: {
      handler() {
        console.log("emit", this.currentData);
        this.$emit("update:modelValue", this.currentData);
      },
      deep: true
    },
    modelValue: {
      handler() {
        this.setCurrentData(this.modelValue);
      },
      deep: true
    },

  },
  mounted() {
    this.setCurrentData(this.modelValue);
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
      if (Object.keys(this.currentData['nodes']).length <= 1 || Object.keys(this.currentData['edges']).length === 0) {
        return
      }

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
      Object.entries(this.currentData['nodes']).forEach(([nodeId, node]) => {
        g.setNode(nodeId, {label: node.name, width: nodeSize, height: nodeSize})
      })

      // Add edges to the graph.
      Object.values(this.currentData['edges']).forEach(edge => {
        g.setEdge(edge.source, edge.target)
      })

      dagre.layout(g)

      g.nodes().forEach((nodeId) => {
        // update node position
        const x = g.node(nodeId).x
        const y = g.node(nodeId).y
        this.currentData['layouts']['nodes'][nodeId] = {x, y}
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
    addNode(nodeType) {
      // create random id
      const id = Math.random().toString(36).substring(7);
      this.currentData['nodes'][id] = {
        type: nodeType,
        saved: false,
        name: this.options['nodes'][nodeType]['label'],
        data: {}
      };

      // add edge to selected node
      if (this.selectedNodes.length > 0) {
        const edge_id = Math.random().toString(36).substring(7);
        this.currentData['edges'][edge_id] = {
          saved: false,
          source: this.selectedNodes[0],
          target: id,
        };
      }

      // open modal for editing node
      this.editNode(id);

    },
    editNode(id) {
      // hide currently open modal
      this.mainModal?.hide();

      // open modal for editing node
      const nodeType = this.currentData['nodes'][id]['type'];
      this.$refs['nodeEditor_' + nodeType][0].open(id, this.currentData['nodes'][id]['data']);
    },
    updateNode(id, data) {
      this.mainModal?.show();
      this.currentData['nodes'][id]['data'] = data;
      this.updateLayout('LR');

    },
    deleteSubNodes(nodeId) {
      Object.entries(this.currentData['edges']).forEach(([edgeId, edge]) => {
        if (edge.target === nodeId) {
          delete this.currentData['edges'][edgeId];
        }
        if (edge.source === nodeId) {
          this.deleteSubNodes(edge.target);
        }
      });
      // remove node
      delete this.currentData['nodes'][nodeId];
    },
    removeNode() {
      // warning that all subsequent nodes are also removed!
      this.mainModal?.hide();
      this.$refs['confirmDeletion'].open(
        "Remove Node",
        "Do you really want to remove the selected node?",
        "All subsequent nodes will also be removed!",
        (res) => {
          if (res) {
            console.log(this.selectedNodes[0]);
            this.deleteSubNodes(this.selectedNodes[0]);

            this.selectedNodes = [];
            this.updateLayout('LR');
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
</style>
