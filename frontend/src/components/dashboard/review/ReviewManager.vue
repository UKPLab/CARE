<template>
<div class="card">
    <div class="card-header d-flex justify-content-between align-items-center">
      Review Processes
    </div>
    <div class="card-body">
      <span v-if="items.length === 0">
        No review processes available...
      </span>
      <table v-else class="table table-hover">
        <thead>
        <tr>
          <th v-for="field in fields" scope="col">{{ field.name }}</th>
          <th scope="col">Actions</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="item in items" :key="item.hash">
          <td v-for="field in fields">{{ item[field.col] }}</td>
          <td>
            <div class="btn-group">
              <button class="btn btn-outline-secondary" data-placement="top" data-toggle="tooltip"
                      title="Access document..." type="button" @click="accessDoc(item.hash)">
                <svg class="bi bi-box-arrow-right" fill="currentColor" height="16" viewBox="0 0 16 16"
                     width="16" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0v2z"
                        fill-rule="evenodd"></path>
                  <path d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z"
                        fill-rule="evenodd"></path>
                </svg>
                <span class="visually-hidden">Access</span>
              </button>

              <button class="btn btn-outline-secondary" data-placement="top" data-toggle="tooltip" title="Delete document..."
                      type="button" @click="deleteDoc(item.id)">
                <svg class="bi bi-trash3-fill" fill="currentColor" height="16" viewBox="0 0 16 16"
                     width="16" xmlns="http://www.w3.org/2000/svg">
                  <path
                      d="M11 1.5v1h3.5a.5.5 0 0 1 0 1h-.538l-.853 10.66A2 2 0 0 1 11.115 16h-6.23a2 2 0 0 1-1.994-1.84L2.038 3.5H1.5a.5.5 0 0 1 0-1H5v-1A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5Zm-5 0v1h4v-1a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5ZM4.5 5.029l.5 8.5a.5.5 0 1 0 .998-.06l-.5-8.5a.5.5 0 1 0-.998.06Zm6.53-.528a.5.5 0 0 0-.528.47l-.5 8.5a.5.5 0 0 0 .998.058l.5-8.5a.5.5 0 0 0-.47-.528ZM8 4.5a.5.5 0 0 0-.5.5v8.5a.5.5 0 0 0 1 0V5a.5.5 0 0 0-.5-.5Z"/>
                </svg>
                <span class="visually-hidden">Delete</span>
              </button>

               <button class="btn btn-outline-primary" type="button" @click="startReview(item.hash)">Start Review Process</button>
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

export default {
  name: "ReviewManager",
  data() {
    return {
      fields: [
        {name: "Document", col: "name"},
        {name: "Created At", col: "createdAt"}
      ]
    }
  },
  mounted() {
    this.load();
  },
  computed: {
    ...mapGetters({items: 'admin/getReviewProcesses'})
  },
  methods: {
    load() {
      //TODO this.$socket.emit("revproc_get_all");
    }
  }
}
</script>

<style scoped>
.card .card-body {
  padding: 1rem;
}
</style>