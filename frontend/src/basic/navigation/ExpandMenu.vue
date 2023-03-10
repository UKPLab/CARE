<template>
  <li class="dropstart">
    <button
      aria-expanded="false"
      class="btn btn-outline rounded-circle me-2"
      data-bs-toggle="dropdown"
      type="button"
    >
      <LoadIcon
        :size="20"
        icon-name="three-dots-vertical"
      />
    </button>
    <ul class="dropdown-menu dropdown-menu-end dropdown-menu-lg-start">
      <span id="topBarExtendMenuItems" />
    </ul>
  </li>
</template>

<script>
import LoadIcon from "@/icons/LoadIcon.vue";

/* ExpandMenu.vue - menu shown on click of the options in the topbar

Author: Dennis Zyska
Source: -
*/
export default {
  name: "ExpandMenu",
  components: {LoadIcon},
}
</script>

<style scoped>

</style>