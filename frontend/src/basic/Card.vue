<template>
  <div class="card">
    <div class="card-header d-flex justify-content-between align-items-center"
         :style="{cursor: collapsable ? 'pointer' : 'auto'}"
         @click="collapsed = !collapsed">
      <h5 class="card-title">{{ title }}</h5>
      <div>
        <slot name="headerElements"></slot>
        <span v-if="collapsable">
          <LoadIcon color="grey" class="me-1" :icon-name="collapsed ? 'arrow-down-short' : 'arrow-up-short'"></LoadIcon>
        </span>
      </div>
    </div>
    <TransitionGroup name="fade">
      <div v-if="!collapsed" class="card-body">
        <slot name="body"></slot>
      </div>
      <div v-if="!collapsed && $slots.footer" class="card-footer">
        <slot name="footer"></slot>
      </div>
    </TransitionGroup>
  </div>
</template>

<script>
import LoadIcon from "@/icons/LoadIcon.vue";

export default {
  name: "Card.vue",
  components: {LoadIcon},
  props: {
    title: {
      type: String,
      required: false,
      default: ""
    },
    collapsable: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  data() {
    return {
      collapsed : false
    }
  },
  methods: {
    setCollapseState(collapse){
      this.collapsed = collapse;
    }
  }
}
</script>

<style scoped>

</style>