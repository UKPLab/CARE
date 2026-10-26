<template>
  <router-link class="card home-tile" to="/dashboard/submissions">
    <span>{{ $t('sidebar.nav.submissions') }}</span>
    <b>{{ count }}</b>
  </router-link>
</template>

<script>
import { isListedAssignment } from "@/assets/utils";

/**
 * Home submissions count. Mounted only while the user can see the tile
 * so assignment rows are not subscribed for everyone on Home.
 */
export default {
  name: "HomeSubmissionsTile",
  subscribeTable: ["assignment"],
  computed: {
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    count() {
      return this.$store.getters["table/assignment/getFiltered"](
        (assignment) => isListedAssignment(assignment, this.userId)
      ).length;
    },
  },
};
</script>
