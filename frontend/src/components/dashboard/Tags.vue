<template>

    <TagSetModal ref="tagSetModal" id="0" ></TagSetModal>


  <div class="card">
    <div class="card-header d-flex justify-content-between align-items-center">
      Tag Sets
      <button class="btn btn-primary btn-sm" v-on:click="this.$refs.tagSetModal.open(0)">Add new tag set</button>
    </div>

    <div class="card-body p-2">
      <Loader v-if="tagSets === null || tags === null" :loading="tagSets === null" text="Collecting data..."></Loader>

      <span v-else-if="tagSets.length === 0">
          No tag sets are available...
        </span>
      <table v-else class="table table-hover">
        <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Created</th>
          <th scope="col">Last change</th>
          <th scope="col">Public</th>
          <th scope="col">User</th>
          <th scope="col">#Tags</th>
          <th scope="col">Actions</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="tagSet in tagSets" :key="tagSet.id">
          <td>{{ tagSet['name'] }}</td>
          <td>{{ new Date(tagSet['createdAt']).toLocaleString("en-US") }}</td>
          <td>{{ new Date(tagSet['updatedAt']).toLocaleString("en-US") }}</td>
          <td>
            <div v-if="tagSet['public'] || tagSet['userId'] === null" class="badge bg-success">Yes</div>
            <div v-else class="badge bg-danger">No</div>
          </td>
          <td>
            <div v-if="tagSet['userId'] === null" class="badge bg-black">System</div>
            <div v-else class="badge bg-black">{{ tagSet['userId'] }}</div>
          </td>
          <td>
            <div :title="tags.filter(tag => tag.setId === tagSet.id).map(e => e.name).join('<br>')" class="badge bg-primary" data-bs-html="true"  data-bs-placement="top" data-bs-toggle="tooltip"
                 role="button">
              {{ tags.filter(tag => tag.setId === tagSet.id).length }}
            </div>
          </td>
          <td>
            <div class="btn-group  btn-group-sm" role="group" aria-label="Basic example">
              <button class="btn btn-outline-dark btn-sm" v-on:click="this.$refs.tagSetModal.open(tagSet.id)" :disabled="tagSet['userId'] === userId">
                <svg class="bi bi-pencil" fill="currentColor" height="12" viewBox="0 0 16 16" width="12"
                     xmlns="http://www.w3.org/2000/svg">
                  <path
                      d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                </svg>
              </button>
              <button class="btn btn-outline-dark btn-sm" @click="deleteTagSet(tagSet.id)">
                <svg class="bi bi-trash" fill="currentColor" height="12" viewBox="0 0 16 16" width="12"
                     xmlns="http://www.w3.org/2000/svg">
                  <path
                      d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                  <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
                        fill-rule="evenodd"/>
                </svg>
              </button>
              <button class="btn btn-outline-dark btn-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-clipboard" viewBox="0 0 16 16">
  <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
  <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
</svg>
              </button>
              <button class="btn btn-outline-dark btn-sm" @click="shareTagSet(tagSet.id)">
                <svg class="bi bi-share" fill="currentColor" height="12" viewBox="0 0 16 16" width="12"
                     xmlns="http://www.w3.org/2000/svg">
                  <path
                      d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5zm-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
                </svg>
              </button>
            </div>
          </td>

        </tr>
        </tbody>
      </table>
    </div>
  </div>


</template>

<script>
import {mapGetters} from "vuex";
import Loader from "../general/Loader.vue";
import {Tooltip} from "bootstrap";
import TagSetModal from "./tags/TagSetModal.vue";

export default {
  name: "Tags",
  components: {TagSetModal, Loader},
  data() {
    return {
      fields: [
        {name: "Name", col: "name"},
        {name: "Created At", col: "createdAt"}
      ],
    }
  },
  props: {
    'admin': {
      required: false,
      default: false
    },
  },
  mounted() {
    this.$socket.emit("getTagSets");
    this.$socket.emit("getTags");
  },
  computed: {
    ...mapGetters({tagSets: 'tag/getTagSets', tags: 'tag/getAllTags', userId: 'auth/getUserId'}),
  },
  watch: {
    tagSets: function (newVal, oldVal) {
      new Tooltip(document.body, {
        selector: "[data-bs-toggle='tooltip']",
      })
    },
    tags: function (newVal, oldVal) {
      new Tooltip(document.body, {
        selector: "[data-bs-toggle='tooltip']",
      })
    }
  },
  methods: {
    addTagSet() {
      this.$socket.emit("addTagSet", {name: "New Tag Set"});
    },
  }
}
</script>

<style scoped>

</style>