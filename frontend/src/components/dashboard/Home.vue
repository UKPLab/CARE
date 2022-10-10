<template>
  <div id="page-content-wrapper" class="row">
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
    </div>
  </div>
</template>

<script>

/* Home.vue - home of the dashboard

This component provides the user-specific view of the app.
It includes a websocket to synchronize with the backend and
loads all further sub-components.

Author: Dennis Zyska (zyska@ukp...)
Co-Author: Nils Dycke (dycke@ukp...)
Source: -
*/
import DocumentManager from "./Documents.vue";
import ReviewManager from "./Reviews.vue";
import MetaReviewManager from "./MetaReviews.vue";

export default {
  name: "Home",
  components: {MetaReviewManager, DocumentManager, ReviewManager},
  computed: {
    isAdmin: function() {
      return this.$store.getters['auth/isAdmin']
    }
  },
}
</script>

<style scoped>

</style>