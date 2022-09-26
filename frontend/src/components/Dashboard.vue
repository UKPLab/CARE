<template>
  <div class="row">
    <div class="col-md-8 mx-auto my-4">
      <ul v-if="isAdmin" class="nav nav-tabs" id="dashtabs" role="tablist">
        <li class="nav-item" role="presentation">
          <button class="nav-link active" id="user-tab" data-bs-toggle="tab" data-bs-target="#user" type="button" role="tab" aria-controls="user" aria-selected="true">User View</button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="admin-tab" data-bs-toggle="tab" data-bs-target="#admin" type="button" role="tab" aria-controls="profile" aria-selected="false">Admin View</button>
        </li>
      </ul>
      <div v-if="isAdmin" class="tab-content" id="dashtabContents">
        <div class="tab-pane fade show active" id="user" role="tabpanel" aria-labelledby="user-tab">
          <div class="container">
            <div class="row">
              <div class="col gy-5">
                <h3> Document Management </h3>
                <DocumentManager :admin=false></DocumentManager>
              </div>
            </div>
            <div class="row">
              <div class="col gy-5">
                <h3>Meta-Review Management</h3>
                <MetaReviewManager></MetaReviewManager>
              </div>
            </div>
          </div>
        </div>
        <div class="tab-pane fade" id="admin" role="tabpanel" aria-labelledby="admin-tab">
          <div class="container">
            <div class="row">
              <div class="col gy-5">
                <h3> Document Management </h3>
                <DocumentManager :admin=true></DocumentManager>
              </div>
            </div>
            <div class="row">
              <div class="col gy-5">
                <h3>Review Management</h3>
                <ReviewManager :admin=true></ReviewManager>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!isAdmin" class="container">
        <div class="row">
          <div class="col gy-5">
            <h3> Document Management </h3>
            <DocumentManager :admin=false></DocumentManager>
          </div>
        </div>
        <div class="row">
          <div class="col gy-5">
            <h3>Meta-Review Management</h3>
            <MetaReviewManager></MetaReviewManager>
          </div>
        </div>
      </div>

      <div class="container">
        <div class="row">
          <div class="col gy-5">
            <h3>Tag Management</h3>
            <TagManager></TagManager>
          </div>
        </div>
      </div>

      <p></p>
      <a href="#" @click="logout()">Logout</a>
    </div>
  </div>
</template>

<script>
/* Dashboard.vue - user-specific dashboard

This component provides the user-specific view of the app.
It includes a websocket to synchronize with the backend and
loads all further sub-components.

Author: Dennis Zyska (zyska@ukp...)
Co-Author: Nils Dycke (dycke@ukp...)
Source: -
*/

import DocumentManager from "./dashboard/documents/DocumentManager.vue";
import ReviewManager from "./dashboard/review/ReviewManager.vue";
import MetaReviewManager from "./dashboard/review/MetaReviewManager.vue";
import TagManager from "./dashboard/settings/TagManager.vue";

export default {
  name: "Dashboard",
  components: {MetaReviewManager, DocumentManager, ReviewManager, TagManager},
  created() {
    this.$socket.on('connect', (data) => {
      console.log('socket connected')
    });
  },

  computed: {
    isAdmin: function() {
      return this.$store.getters['auth/isAdmin']
    }
  },

  sockets: {
    connect: function () {
      console.log('socket connected')
    },
    logout: function (data) {
      this.$router.push("/login");
    }
  },
  methods: {
    async logout() {
      await this.$store.dispatch('auth/logout');
      await this.$router.push("/login");
    }
  },
}
</script>

<style scoped>
</style>