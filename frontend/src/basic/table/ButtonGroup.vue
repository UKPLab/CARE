<template>
  <div class="btn-group">
    <TableButton v-for="b in buttons"
                       :icon="b.icon"
                       :title="b.title"
                       :options="b.options"
                       :onClick="b.onClick"
                       :params="params"
          ></TableButton>
  </div>
</template>

<script>
import LoadIcon from "@/icons/LoadIcon.vue";
import TableButton from "./Button.vue";

export default {
  name: "TableButtonGroup.vue",
  components: {LoadIcon, TableButton},
  props: {
    buttons: {
      type: Array,
      required: true
    },
    params: {
      type: Array,
      required: false,
      default: []
    }
  }
}
</script>

<style scoped>
</style>