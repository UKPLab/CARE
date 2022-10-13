<template>
  <Modal ref="tagSetModal" lg>
    <template v-slot:title>
      <span v-if="id === 0">New</span>
      <span v-else>Edit</span>
      Tagset
    </template>
    <template v-slot:body>
      <div class="mb-3">
        <label class="form-label" for="tagset_name">Name</label>
        <input id="tagset_name" v-model="tagSet.name" class="form-control" placeholder="Name of the tagset" type="text">
      </div>

      <div class="mb-3">
        <label class="form-label" for="tagset_description">Description</label>
        <input id="tagset_description" v-model="tagSet.description" class="form-control"
               placeholder="Description of the tagset" type="text">
      </div>

      <div class="mb-3">
        <label class="form-label" for="tagset_tags">Tags
        </label>
        <TagsTable :setId="id"></TagsTable>

      </div>

    </template>
    <template v-slot:footer>
      <button class="btn btn-secondary" type="button" @click="cancel">Back</button>
      <button class="btn btn-primary me-2" type="button" @click="submit">Save</button>

    </template>
  </Modal>
</template>

<script>
import Tags from "bootstrap5-tags/tags.js";
import Modal from "../../basic/Modal.vue";
import TagsTable from "./TagsTable.vue";
import {mapMutations} from "vuex";

export default {
  name: "TagSetModal",
  components: {TagsTable, Modal},
  data() {
    return {
      id: 0,
    }
  },
  mounted() {
    Tags.init(`#tagset_tags`);
  },

  computed: {
    tagSet() {
      return this.$store.getters['tag/getTagSet'](this.id);
    },
  },
  methods: {
    ...mapMutations({cleanEmptyTagSet: "tag/CLEAN_EMPTY_TAG_SET", copyTagSet: "tag/COPY_TAG_SET"}),
    new() {
      this.cleanEmptyTagSet();
      this.open(0);
    },
    edit(id) {
      this.open(id);
    },
    copy(id) {
      this.copyTagSet(id);
      this.open(0);
    },
    open(id) {
      this.id = id;
      this.$refs.tagSetModal.openModal();
      this.$socket.emit("stats", {
        action: "openModalTagSet",
        data: {id: this.id}
      });
    },
    cancel() {
      this.$refs.tagSetModal.closeModal();
      this.$socket.emit("stats", {
        action: "cancelModalTagSet",
        data: {id: this.id}
      });
    },
  },

}
</script>

<style scoped>

</style>