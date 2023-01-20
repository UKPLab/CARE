<template>
  <span v-if="showEditByCollab">
    <LoadIcon :size="12 " class="fading" iconName="pencil-fill"></LoadIcon>
  </span>
</template>

<script>
import {v4 as uuidv4} from "uuid";
import LoadIcon from "@/icons/LoadIcon.vue";

export default {
  name: "Collaboration.vue",
  components: {LoadIcon},
  emits: ["collabStatus"],
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
  computed: {
    collaborations() {
      return this.$store.getters["collab/getCollab"](this.targetType, this.targetId);
    },
  },
  methods: {
    updateCollab() {
      this.$socket.emit("collabUpdate", {collabId: this.collabId});
    },
    startCollab() {
      this.collabHash = uuidv4();
      this.$socket.emit("collabAdd",
          {
            targetType: this.targetType,
            targetId: this.targetId,
            documentId: this.documentId,
            collabHash: this.collabHash
          });
    },
    removeCollab() {
      if(this.collabId !== null){
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