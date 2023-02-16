<template>
  <Modal ref="tagSetModal" :props="{tagsetId: id}" lg name="tagsetModal">
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
        <TagsTable :tagSetId="id"></TagsTable>

      </div>

    </template>
    <template v-slot:footer>
      <button v-if="id === 0" class="btn btn-secondary" type="button" @click="back">Back</button>
      <button v-else class="btn btn-secondary" type="button" @click="cancel">Cancel</button>
      <button class="btn btn-primary me-2" type="button" @click="save">Save</button>

    </template>
  </Modal>
</template>

<script>
/* TagSetModal.vue - modal component for adding and editing tagssets

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/
import Tags from "bootstrap5-tags/tags.js";
import Modal from "@/basic/Modal.vue";
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
    ...mapMutations({cleanEmptyTagSet: "tag/CLEAN_EMPTY_TAG_SET", cleanEmptyTags: "tag/CLEAN_EMPTY_TAGS", copyTagSet: "tag/COPY_TAG_SET"}),
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
    },
    save() {
      this.sockets.subscribe("tagSetRefresh", (data) => {
        this.$refs.tagSetModal.closeModal();
        this.sockets.unsubscribe('tagSetRefresh');
        this.eventBus.emit('toast', {title: "Tagset saved", message: "Successful saved tagset!", variant: "success"});
      });
      this.$socket.emit("tagSetUpdate", {
        "tagSetId": this.id,
        "tagSet": this.$store.getters["tag/getTagSet"](this.id),
        "tags": this.$store.getters["tag/getTags"](this.id, false)
      });
      this.cleanEmptyTags(this.id);
      this.$refs.tagSetModal.waiting = true;
    },
    cancel() {
      this.$socket.emit("tagSetGet", {tagSetId: this.id});
      this.back();
    },
    back() {
      this.$refs.tagSetModal.closeModal();
    },
  },

}
</script>

<style scoped>

</style>