<template>
  <div class="card">
    <div
      class="card-header d-flex justify-content-between align-items-center"
      :style="{cursor: collapsable ? 'pointer' : 'auto'}"
      @click="toggleCollabs()"
    >
      <h5 class="card-title">
        {{ title }}
      </h5>
      <div>
        <slot name="headerElements" />
        <span v-if="collapsable">
          <LoadIcon
            color="grey"
            class="me-1"
            :icon-name="collapsed ? 'arrow-down-short' : 'arrow-up-short'"
          />
        </span>
      </div>
    </div>
    <TransitionGroup name="fade">
      <div
        v-if="!collapsed"
        class="card-body"
      >
        <slot name="body" />
      </div>
      <div
        v-if="!collapsed && $slots.footer"
        class="card-footer"
      >
        <slot name="footer" />
      </div>
    </TransitionGroup>
  </div>
</template>

<script>
import LoadIcon from "@/icons/LoadIcon.vue";

/* Card.vue - default card component for layouting

Use this component to show a card with extra features including e.g. collapsing. Provides slots.


Author: Dennis Zyska, Nils Dycke
Source: -
*/
export default {
  name: "Card",
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
    },
    toggleCollabs(){
      if(this.collapsable){
        this.collapsed = !this.collapsed;
      }
    }
  }
}
</script>

<style scoped>

</style>