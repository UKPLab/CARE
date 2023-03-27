<template>
  <Modal
    ref="tagSetModal"
    :props="{tagsetId: id}"
    lg
    name="tagsetModal"
  >
    <template #title>
      <span v-if="id === 0">New</span>
      <span v-else>Edit</span>
      Tagset
    </template>
    <template #body>
      <div class="mb-3">
        <label
          class="form-label"
          for="tagset_name"
        >Name</label>
        <input
          id="tagset_name"
          v-model="tagSet.name"
          class="form-control"
          placeholder="Name of the tagset"
          type="text"
        >
      </div>

      <div class="mb-3">
        <label
          class="form-label"
          for="tagset_description"
        >Description</label>
        <input
          id="tagset_description"
          v-model="tagSet.description"
          class="form-control"
          placeholder="Description of the tagset"
          type="text"
        >
      </div>

      <div class="mb-3">
        <label
          class="form-label"
          for="tagset_tags"
        >Tags
        </label>
        <TagsTable :tag-set-id="id" />
      </div>
    </template>
    <template #footer>
      <button
        v-if="id === 0"
        class="btn btn-secondary"
        type="button"
        @click="back"
      >
        Back
      </button>
      <button
        v-else
        class="btn btn-secondary"
        type="button"
        @click="cancel"
      >
        Cancel
      </button>
      <button
        class="btn btn-primary me-2"
        type="button"
        @click="save"
      >
        Save
      </button>
    </template>
  </Modal>
</template>

<script>
import Tags from "bootstrap5-tags/tags.js";
import Modal from "@/basic/Modal.vue";
import TagsTable from "../tags/TagsTable.vue";
import {mapMutations} from "vuex";
import BasicForm from "@/basic/Form.vue";

/* TagSetModal.vue - modal component for adding and editing tagssets

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/
export default {
  name: "TagSetModal",
  components: {TagsTable, Modal, BasicForm},
  data() {
    return {
      studyId: 0,
      documentId: 0,
      defaultValue: {
        name: "",
        documentId: 0,
        collab: false,
        resumable: true,
        timeLimit: 0,
        description: "",
        start: null,
        end: null,
      },
      study: {},
      dynamicFields: [],
      staticFields: [
        {
          name: "name",
          label: "Name of the study:",
          placeholder: "My user study",
          type: "text",
          required: true,
        },
        {
          name: "description",
          label: "Description of the study:",
          help: "This text will be displayed at the beginning of the user study!",
          type: "editor",
        },
        {
          name: "timeLimit",
          type: "slider",
          label: "How much time does a participant have for the study?",
          help: "0 = disable time limitation",
          size: 12,
          unit: "min",
          min: 0,
          max: 180,
          step: 1,
          required: false,
        },
        {
          name: "collab",
          label: "Should the study be collaborative?",
          type: "switch",
          required: true,
        },
        {
          name: "resumable",
          label: "Should the study be resumable?",
          type: "switch",
          required: true,
        },
        {
          name: "start",
          label: "Study sessions can't start before",
          type: "datetime",
          size: 6,
          required: true,
        },
        {
          name: "end",
          label: "Study sessions can't start after:",
          type: "datetime",
          size: 6,
          required: true,
        },
      ],
      success: false,
      hash: null,
      resets: 0,
    }
  },
  watch: {
    newTagSetData() {
      this.tagSet = this.newTagSetData;
    },
  },
  computed: {
    newTagSetData() {
      // eslint-disable-next-line no-unused-vars
      const resetCounter = this.resets; //do not remove; need for refreshing study object on modal hide!
      if (this.tagSetId === 0) {
        let defaultObject = {...this.defaultValue};
        return defaultObject;
      } else {
        return {...this.$store.getters['tag/getTagSet'](this.tagSetId)};
      }
    },
  },
  mounted() {
    Tags.init(`#tagset_tags`);
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