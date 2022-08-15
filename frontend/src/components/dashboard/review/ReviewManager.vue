<template>
<div class="card">
    <div class="card-header d-flex justify-content-between align-items-center">
      Reviews
    </div>
    <div class="card-body">
      <span v-if="items.length === 0">
        No reviews...
      </span>
      <table v-else class="table table-hover">
        <thead>
        <tr>
          <th scope="col">Status</th>
          <th v-for="field in fields" scope="col">{{ field.name }}</th>
          <th scope="col">Actions</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="item in items" :key="item.hash">
          <td>
            <span v-if="getStatus(item) === 'SUBMITTED'"
                  class="badge badge-success"
                  style="background-color: green">
              Submitted
            </span>
            <span v-else class="badge badge-warning" style="background-color: #e0a800">Pending</span>
          </td>
          <td v-for="field in fields">{{ item[field.col] }}</td>
          <td>
            <div class="btn-group">
              <button class="btn btn-outline-secondary" data-placement="top" data-toggle="tooltip"
                      title="Access document..." type="button" @click="this.$router.push(`/annotate/${item.document}`)">
                <svg class="bi bi-box-arrow-right" fill="currentColor" height="16" viewBox="0 0 16 16"
                     width="16" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0v2z"
                        fill-rule="evenodd"></path>
                  <path d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z"
                        fill-rule="evenodd"></path>
                </svg>
                <span class="visually-hidden">Access</span>
              </button>
              <button v-if="admin===true" class="btn btn-outline-secondary" data-placement="top" data-toggle="tooltip"
                      title="Assign editor..." type="button" @click="assignEditor(item)">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrows-angle-contract" viewBox="0 0 16 16">
                  <path fill-rule="evenodd" d="M.172 15.828a.5.5 0 0 0 .707 0l4.096-4.096V14.5a.5.5 0 1 0 1 0v-3.975a.5.5 0 0 0-.5-.5H1.5a.5.5 0 0 0 0 1h2.768L.172 15.121a.5.5 0 0 0 0 .707zM15.828.172a.5.5 0 0 0-.707 0l-4.096 4.096V1.5a.5.5 0 1 0-1 0v3.975a.5.5 0 0 0 .5.5H14.5a.5.5 0 0 0 0-1h-2.768L15.828.879a.5.5 0 0 0 0-.707z"/>
                </svg>
                <span class="visually-hidden">Assign</span>
              </button>
              <button v-else class="btn btn-outline-secondary" data-placement="top" data-toggle="tooltip"
                      title="Make acceptance decision..." type="button" @click="this.$router.push(`/approve/${item.hash}`)">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-award" viewBox="0 0 16 16">
                  <path d="M9.669.864 8 0 6.331.864l-1.858.282-.842 1.68-1.337 1.32L2.6 6l-.306 1.854 1.337 1.32.842 1.68 1.858.282L8 12l1.669-.864 1.858-.282.842-1.68 1.337-1.32L13.4 6l.306-1.854-1.337-1.32-.842-1.68L9.669.864zm1.196 1.193.684 1.365 1.086 1.072L12.387 6l.248 1.506-1.086 1.072-.684 1.365-1.51.229L8 10.874l-1.355-.702-1.51-.229-.684-1.365-1.086-1.072L3.614 6l-.25-1.506 1.087-1.072.684-1.365 1.51-.229L8 1.126l1.356.702 1.509.229z"/>
                  <path d="M4 11.794V16l4-1 4 1v-4.206l-2.018.306L8 13.126 6.018 12.1 4 11.794z"/>
                </svg>
                <span class="visually-hidden">Acceptance Decision</span>
              </button>
              <button v-if="admin===true" :class="item.accepted === null ? 'disabled' : ''" class="btn btn-outline-secondary"
                      data-placement="top"
                      data-toggle="tooltip"
                      title="View decision..."
                      type="button"
                      @click="viewDecision(item)">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-award" viewBox="0 0 16 16">
                  <path d="M9.669.864 8 0 6.331.864l-1.858.282-.842 1.68-1.337 1.32L2.6 6l-.306 1.854 1.337 1.32.842 1.68 1.858.282L8 12l1.669-.864 1.858-.282.842-1.68 1.337-1.32L13.4 6l.306-1.854-1.337-1.32-.842-1.68L9.669.864zm1.196 1.193.684 1.365 1.086 1.072L12.387 6l.248 1.506-1.086 1.072-.684 1.365-1.51.229L8 10.874l-1.355-.702-1.51-.229-.684-1.365-1.086-1.072L3.614 6l-.25-1.506 1.087-1.072.684-1.365 1.51-.229L8 1.126l1.356.702 1.509.229z"/>
                  <path d="M4 11.794V16l4-1 4 1v-4.206l-2.018.306L8 13.126 6.018 12.1 4 11.794z"/>
                </svg>
                <span class="visually-hidden">Decision reason</span>
              </button>
            </div>
          </td>
        </tr>
        </tbody>
      </table>
    </div>
</div>
  <EditorSelect v-if="admin===true" ref="editorSelect"></EditorSelect>
  <DecisionView v-if="admin===true" ref="decisionView"></DecisionView>
</template>

<script>

import EditorSelect from "../modals/EditorSelect.vue";
import DecisionView from "../modals/DecisionView.vue";
export default {
  name: "ReviewManager",
  components: {EditorSelect, DecisionView},
  data() {
    return {
    }
  },
  props: {
    'admin': {
      required: false,
      default: false
    },
  },
  mounted() {
    this.load();
  },
  computed: {
    items() {
      if(this.admin){
        return this.$store.getters['admin/getReviews'];
      } else {
        return this.$store.getters['user/getMetaReviews'];
      }
    },
    fields() {
      let fields =  [
        {name: "Document", col: "document"},
        {name: "Started At", col: "createdAt"}
      ];

      if(this.admin){
        fields.push({name: "Reviewer", col: "startBy"});
        fields.push({name: "Editor", col: "decisionBy"});
        fields.push({name: "Decision", col: "accepted"});
      }

      return fields;
    }
  },
  methods: {
    load() {
      if(this.admin){
        this.$socket.emit("getAllReviews");
      } else {
        this.$socket.emit("getMetaReviews");
      }
    },
    assignEditor(review){
      this.$refs.editorSelect.open(review);
    },
    viewDecision(review){
      this.$refs.decisionView.open(review);
    },
    getStatus(review) {
      if (review["submitted"]) {
        return "SUBMITTED";
      } else {
        return "DUE";
      }
    }
  }
}
</script>

<style scoped>
.card .card-body {
  padding: 1rem;
}
</style>