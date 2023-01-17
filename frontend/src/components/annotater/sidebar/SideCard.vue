<template>
  <b-card ref="card" :class="{ shake: shake }" class="card">
    <div class="card-header">
      <div class="container-fluid">
        <slot name="header"></slot>

      </div>
    </div>
    <div class="card-body p-1">
      <div class="d-grid gap-1 my-2">
        <slot name="body"></slot>
      </div>
    </div>
    <div v-if="hasFooterSlot" class="card-footer">
      <div id="footer-controls" class="container">
        <slot name="footer"></slot>
      </div>
    </div>
    <div v-if="hasThreadSlot" class="card-body p-1">
      <slot name="thread"></slot>
    </div>
  </b-card>
</template>

<script>
/* SideCard.vue - card template for sidebar

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/

export default {
  name: "SideCard.vue",
  props: {
    shake: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  computed: {
    hasFooterSlot() {
      return !!this.$slots.footer;
    },
    hasThreadSlot() {
      return !!this.$slots.thread;
    }
  },
}
</script>

<style scoped>
.shake {
  animation: shake 0.82s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  transform: translate3d(0, 0, 0);
}

@keyframes shake {
  10%,
  90% {
    transform: translate3d(-1px, 0, 0);
  }

  20%,
  80% {
    transform: translate3d(2px, 0, 0);
  }

  30%,
  50%,
  70% {
    transform: translate3d(-4px, 0, 0);
  }

  40%,
  60% {
    transform: translate3d(4px, 0, 0);
  }
}

.card {
  padding: 0px;
}

.card-body {
  font-size: smaller;
  color: #929292;
}

.card-header {
  font-size: smaller;
  color: #929292;
}

.card-footer {
  padding: 0;
}

#footer-controls {
  padding: 4px;
}

#footer-controls .btn {
  border: none;
}


</style>