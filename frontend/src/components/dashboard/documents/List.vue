<template>
  <div class="card">
    <div class="card-header d-flex justify-content-between align-items-center">
      Documents
      <Upload @addedDoc="onAddedDoc"></Upload>
    </div>
    <div class="card-body">
      <span v-if="items.length === 0">
        No Documents available...
      </span>
    <table v-else class="table table-hover">
      <thead>
        <tr>
          <th v-for="field in fields" scope="col">{{field.name}}</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items">
          <td v-for="field in fields">{{item[field.col]}}</td>
          <td>
              <button type="button" class="btn btn-outline-secondary" @click="accessDoc(item.hash)" data-toggle="tooltip" data-placement="top" title="Access document...">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-box-arrow-right" viewBox="0 0 16 16">
                  <path fill-rule="evenodd" d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0v2z"></path>
                  <path fill-rule="evenodd" d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z"></path>
                </svg>
                <span class="visually-hidden">Access</span>
              </button>
              <button type="button" class="btn btn-outline-secondary" @click="deleteDoc(item.uid)" data-toggle="tooltip" data-placement="top" title="Delete document...">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3-fill" viewBox="0 0 16 16">
                  <path d="M11 1.5v1h3.5a.5.5 0 0 1 0 1h-.538l-.853 10.66A2 2 0 0 1 11.115 16h-6.23a2 2 0 0 1-1.994-1.84L2.038 3.5H1.5a.5.5 0 0 1 0-1H5v-1A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5Zm-5 0v1h4v-1a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5ZM4.5 5.029l.5 8.5a.5.5 0 1 0 .998-.06l-.5-8.5a.5.5 0 1 0-.998.06Zm6.53-.528a.5.5 0 0 0-.528.47l-.5 8.5a.5.5 0 0 0 .998.058l.5-8.5a.5.5 0 0 0-.47-.528ZM8 4.5a.5.5 0 0 0-.5.5v8.5a.5.5 0 0 0 1 0V5a.5.5 0 0 0-.5-.5Z"/>
                </svg>
                <span class="visually-hidden">Delete</span>
              </button>
            <!--<button type="button" class="btn btn-outline-secondary" @click="renameDoc(item.uid, 'default_name')" data-toggle="tooltip" data-placement="top" title="Rename document...">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16">
                  <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
                  <path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/>
                </svg>
                <span class="visually-hidden">Rename</span>
            </button>-->
          </td>
        </tr>
      </tbody>
  </table>
    </div>
  </div>
</template>

<script>
import {mapGetters, mapActions} from "vuex";
import Upload from "./Upload.vue";
import axios from "axios";

export default {
  name: "List",
  components: {Upload},
  data() {
    return {
      fields: [
          {name: "ID", col: "uid"},
          {name: "Title", col: "name"},
          {name: "Created At", col: "created_at"}
      ]
    }
  },
  mounted() {
    this.load();
  },
  computed: {
    ...mapGetters({items: 'user/getDocuments'})
  },
  methods: {
    ...mapActions({load: "user/load", delete: "user/delete"}),
    accessDoc(docHash) {
      let routeData = this.$router.resolve(`/annotate/${docHash}`);
      window.open(routeData.href, '_blank');
    },
    onAddedDoc(){
      this.load();
    },
    async deleteDoc(docId){
      const response = axios.post('/api/delete', {docId: docId})
                              .then(async (res) => {
                                await this.load();
                              })
                              .catch((err) => {
                                throw err;
                              });
    },
    async renameDoc(docId, name){
      const response = axios.post('/api/rename', {docId: docId, newName: name})
                                    .then(async (res) => {
                                      await this.load();
                                    })
                                    .catch((err) => {
                                      throw err;
                                    });
    }
  }
}
</script>

<style scoped>

</style>