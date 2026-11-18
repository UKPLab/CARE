<template>
  <!-- Two root nodes on purpose: they must stay direct children of #sidebar-wrapper. -->
  <div v-if="showVersion && !isCollapsed" class="text-center text-secondary">
    {{ $t('common.appVersion') }}: {{ version }}
  </div>

  <div
    class="collapse-sidebar-container list-group-item-action list-group-item list-group-item-custom"
    :title="$t('navigation.sidebar.toggleSidebar')"
    @click="$emit('toggle')"
  >
    <span class="arrow-toggle sidebar-icon">
      <LoadIcon name="chevron-double-right" />
    </span>

    <!-- Expanded mode -->
    <div v-if="!isCollapsed" class="list-group-item-text" style="cursor:pointer">
      {{ $t('navigation.sidebar.collapseSidebar') }}
    </div>
  </div>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";

/**
 * Bottom of the dashboard sidebar: app version (admins only) and the
 * collapse/expand toggle.
 *
 * @author Carly Gettinger, Dennis Zyska, Nils Dycke, Andrii Nikitin
 */
export default {
  name: "SidebarFooter",
  components: { LoadIcon },
  props: {
    isCollapsed: {
      type: Boolean,
      default: false,
    },
    showVersion: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["toggle"],
  data() {
    return {
      version: APP_VERSION,
    };
  },
};
</script>

<style>
.collapse-sidebar-container {
  border-top: 1px solid rgba(0, 0, 0, 0.125);
}

#sidebar-wrapper.collapsed > .collapse-sidebar-container .list-group-item-text,
#sidebar-wrapper.collapsed > .text-secondary {
  display: none !important;
}

#sidebar-wrapper.collapsed .collapse-sidebar-container {
  justify-content: center !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
}

.arrow-toggle {
  transform: rotate(180deg);
}

body.sb-sidenav-toggled .arrow-toggle {
  transform: rotate(0deg);
}
</style>
