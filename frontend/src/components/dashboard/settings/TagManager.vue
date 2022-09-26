<template>
  <div class="card">
    <div class="card-header d-flex justify-content-between align-items-center">
      Tag Sets
      <button class="btn btn-primary" @click="addTagSet">Add Tag Set</button>
    </div>

    <div class="card-body p-4">
      <Loader v-if="items === null" :loading="items === null" text="Collecting data..."></Loader>

      <span v-else-if="items.length === 0">
          No tag sets are available...
        </span>
      <table v-else class="table table-hover">
        <thead>
        <tr>
          <th v-for="field in fields" scope="col">{{ field.name }}</th>
          <th scope="col">Manage</th>
          <th scope="col">Review</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="item in items" :key="item.hash">
          <td v-for="field in fields">{{ item[field.col] }}</td>
          <td>
            <div class="btn-group">
              <button class="btn btn-outline-secondary" data-placement="top" data-toggle="tooltip"
                      title="Delete document..."
                      type="button" @click="deleteDoc(item.id)">
                <svg class="bi bi-trash3-fill" fill="currentColor" height="16" viewBox="0 0 16 16"
                     width="16" xmlns="http://www.w3.org/2000/svg">
                  <path
                      d="M11 1.5v1h3.5a.5.5 0 0 1 0 1h-.538l-.853 10.66A2 2 0 0 1 11.115 16h-6.23a2 2 0 0 1-1.994-1.84L2.038 3.5H1.5a.5.5 0 0 1 0-1H5v-1A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5Zm-5 0v1h4v-1a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5ZM4.5 5.029l.5 8.5a.5.5 0 1 0 .998-.06l-.5-8.5a.5.5 0 1 0-.998.06Zm6.53-.528a.5.5 0 0 0-.528.47l-.5 8.5a.5.5 0 0 0 .998.058l.5-8.5a.5.5 0 0 0-.47-.528ZM8 4.5a.5.5 0 0 0-.5.5v8.5a.5.5 0 0 0 1 0V5a.5.5 0 0 0-.5-.5Z"/>
                </svg>
                <span class="visually-hidden">Delete</span>
              </button>
            </div>
          </td>
          <td>
            <button :class="reviewState(item.hash) === 'SUBMITTED' ? 'disabled btn-outline-secondary' : reviewState(item.hash) === 'PENDING' ? 'btn-outline-primary' : 'btn-outline-success'"
                    class="btn"
                    type="button"
                    @click="startReview(item.hash)">{{
                reviewState(item.hash) === "PENDING" ? "Continue"
                    : (reviewState(item.hash) === "SUBMITTED" ? "Submitted" : "Start")
              }}
            </button>
          </td>
        </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import {mapGetters, mapActions} from "vuex";
import Loader from "../../general/Loader.vue";


export default {
  name: "TagManager",
  components: {Loader},
  data() {
    return {
      fields: [
        {name: "Title", col: "name"},
        {name: "Created At", col: "createdAt"}
      ],
      loading: true,
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
  },
  computed: {
    ...mapGetters({items: 'tag/getTagSets'})
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