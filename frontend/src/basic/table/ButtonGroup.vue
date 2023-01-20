<template>
  <div class="btn-group">
    <TableButton v-for="b in buttons"
                 :action="b.action"
                 :icon="b.icon"
                 :options="b.options"
                 :params="params"
                 :title="b.title"
                 @action="actionEmitter"
    ></TableButton>
  </div>
</template>

<script>
import LoadIcon from "@/icons/LoadIcon.vue";
import TableButton from "./Button.vue";

export default {
  name: "TableButtonGroup.vue",
  components: {LoadIcon, TableButton},
  emits: ['action'],
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
  },
  methods: {
    actionEmitter(data){
      this.$emit('action', data);
    }
  }
}
</script>

<style scoped>
</style>