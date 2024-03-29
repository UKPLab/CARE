<template>
  <div
      ref="top"
      :class="{ shake: shake }"
      class="card p-2"
  >
    <div
        v-if="!loading"
        class="card-header"
    >
      <div class="container-fluid">
        <slot name="header"/>
      </div>
    </div>
    <div class="card-body p-1">
      <div
          v-if="!loading"
          class="d-grid gap-1 my-2"
      >
        <slot name="body"/>
      </div>
      <div v-else>
        <Loader :loading="loading"/>
      </div>
    </div>
    <div
        v-if="!loading && hasFooterSlot"
        class="card-footer"
    >
      <div
          id="footer-controls"
          class="container"
      >
        <slot name="footer"/>
      </div>
    </div>
    <div
        v-if="!loading && hasThreadSlot"
        class="card-body p-1"
    >
      <slot name="thread"/>
    </div>
  </div>
</template>

<script>
import Loader from "@/basic/Loading.vue";
import {computed} from "vue";

/**
 * Card template for sidebar
 *
 * Generic component providing a standardized card to be included in the sidebar.
 *
 * @author: Nils Dycke, Dennis Zyska
 *
 */
export default {
  name: "SideCard",
  components: {Loader},
  props: {
    shake: {
      type: Boolean,
      required: false,
      default: false,
    },
    loading: {
      type: Boolean,
      required: false,
      default: false,
    }
  },
  provide() {
    return {
      listenOnActive: computed(() => this.checkFocus),
      unlistenOnActive: computed(() => this.uncheckFocus),
    }
  },
  data() {
    return {
      focusListener: null,
      defFocusListener: function (e) {
        const active = this.topHtml === e.target || this.topHtml.contains(e.target);
        Object.values(this.actions).map(a => a.action(active));
      }.bind(this),
      actions: {},
      topHtml: null,
      focused: false
    }
  },
  computed: {
    hasFooterSlot() {
      return !!this.$slots.footer;
    },
    hasThreadSlot() {
      return !!this.$slots.thread;
    }
  },
  mounted() {
    this.topHtml = this.$refs.top;
  },
  beforeUnmount() {
    // just to make sure: cancel possible event listeners, if still attached
    try {
      window.removeEventListener("click", this.focusListener);
    } catch (e) {
      // do nothing
    }
  },
  methods: {
    checkFocus(a) {
      this.actions[a.id] = a;

      if (!this.focusListener) {
        this.focusListener = this.defFocusListener;
        window.addEventListener("click", this.focusListener);
      }
    },
    uncheckFocus(a) {
      if(this.actions[a.id]){
        delete this.actions[a.id];
      }

      if (Object.keys(this.actions).length === 0) {
        try {
          window.removeEventListener("click", this.focusListener);
        } catch (e) {
          // do nothing
        }
        this.focusListener = null;
      }
    }
  }
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
  padding: 0;
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