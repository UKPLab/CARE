<template>
  <span v-if="showEditByCollab">
    <LoadIcon :size="12 " class="fading" iconName="pencil-fill"></LoadIcon>
  </span>
</template>

<script>
import {v4 as uuidv4} from "uuid";
import LoadIcon from "../../icons/LoadIcon.vue";

export default {
  name: "Collaboration.vue",
  components: {LoadIcon},
  emits: ["collabStatus"],
  props: {
  },
  data() {
    return {
      edit_mode: false,
      collab_updater: null,
      collab_id: null,
    }
  },
  sockets: {
    start_collab: function (data) {
      if (data.id === this.collab_id) {
        this.edit_mode = true;
        if (this.collab_updater !== null) {
          clearInterval(this.collab_updater);
        }
        this.collab_updater = setInterval(() => {
          this.update_collab();
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
  computed: {
    collaborations() {
      return this.$store.getters["collab/annotations"](this.annotation_id);
    },
  },
  methods: {
    start_collab() {
      this.collab_id = uuidv4();
      this.$socket.emit("add_collab",
          {
            type: "annotation",
            doc_id: this.document_id,
            annotation_id: this.annotation_id,
            id: this.collab_id
          });
    },
    update_collab() {
      this.$socket.emit("update_collab", {id: this.collab_id});
    },
    remove_collab() {
      this.$socket.emit("remove_collab", {id: this.collab_id});
      if (this.collab_updater !== null) {
        clearInterval(this.collab_updater);
        this.collab_updater = null;
      }
      this.edit_mode = false;
      this.collab_id = null;
    },
  }
}
</script>

<style scoped>

</style>