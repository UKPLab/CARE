<template>
  <span v-if="showEditByCollab">
    <LoadIcon
      :size="12 "
      class="fading"
      icon-name="pencil-fill"
    />
  </span>
</template>

<script>
import {v4 as uuidv4} from "uuid";
import LoadIcon from "@/basic/Icon.vue";

/**
 * Default component managing collaborations
 *
 * Use this component to synchronize actions with the server that are based on the same document view. E.g. to
 * collab on comments.
 *
 * Include e.g.:
 *
 *    <Collaboration ref="collab" @collabStatus="visualizeCollab" targetType="doc" :targetId="commentId" :documentId="documentId" />
 *    ...
 *    this.$refs.collab.startCollab();
 *    ...
 *    visualizeCollab(res){
 *     console.log(res ? "Collaboration!" : "No Collaboration!");
 *    }
 *
 * @author: Dennis Zyska, Nils Dycke
 *
 */
export default {
  name: "BasicCollaboration",
  components: {LoadIcon},
  props: {
    targetType: {
      type: String,
      required: true
    },
    targetId: {
      type: Number,
      required: true
    },
    documentId: {
      type: Number,
      required: true
    },
  },
  emits: ["collabStatus"],
  data() {
    return {
      editMode: false,
      collabUpdater: null,
      collabId: null,
      collabHash: null,
      showEditByCollab: false
    }
  },
  sockets: {
    collabStart: function (data) {
      if (data.collabHash === this.collabHash) {
        this.collabId = data.collabId;
        this.editMode = true;
        this.$emit('collabStatus', true);

        if (this.collabUpdater !== null) {
          clearInterval(this.collabUpdater);
        }
        this.collabUpdater = setInterval(() => {
          this.updateCollab();
        }, 1000);
      }
    }
  },
  computed: {
    collaborations() {
      return this.$store.getters["table/collab/getFiltered"](
        e => e.targetType === this.targetType && e.targetId === this.targetId
      ).filter(c => (Date.now() - Date.parse(c.timestamp)) < 2100);
    },
  },
  watch: {
    collaborations(t) {
      if (t.length > 0) {
        this.showEditByCollab = true;
        if (this.showEditTimeout !== null) {
          clearTimeout(this.showEditTimeout);
        }
        this.showEditTimeout = setTimeout(() => {
          this.showEditByCollab = false;
          this.showEditTimeout = null;
        }, 1000);
      }
    }
  },
  unmounted() {
    if (this.editMode) {
      this.removeCollab();
    }
  },
  methods: {
    updateCollab() {
      this.$socket.emit("collabUpdate", {collabId: this.collabId});
    },
    startCollab() {
      this.collabHash = uuidv4();
      this.$socket.emit("collabUpdate",
        {
          targetType: this.targetType,
          targetId: this.targetId,
          documentId: this.documentId,
          collabHash: this.collabHash
        });
    },
    removeCollab() {
      if (this.collabId !== null) {
        this.$socket.emit("collabDelete", {collabId: this.collabId});
        if (this.collabUpdater !== null) {
          clearInterval(this.collabUpdater);
          this.collabUpdater = null;
        }
        this.editMode = false;
        this.$emit("collabStatus", false);
        this.collabId = null;
        this.collabHash = null;
      }
    },
  }
}
</script>

<style scoped>

</style>