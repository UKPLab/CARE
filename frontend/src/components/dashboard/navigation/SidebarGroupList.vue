<template>
  <div class="sidebar-scroll-area">
    <slot />
    <div class="list-group-test">
      <span>
        <SidebarGroup
          v-for="subgroup in groups"
          :key="subgroup.key"
          :subgroup="subgroup"
          :is-collapsed="isCollapsed"
          :is-open="!!groupStates[subgroup.key]"
          :is-active="activeGroup === subgroup.key"
          :is-hovered="hoveredGroup === subgroup.key"
          :active-element-id="activeElementId"
          :favorite-ids="favoriteIds"
          :favorite-disabled="favoriteDisabled"
          @toggle="$emit('toggle', subgroup.key)"
          @hover="$emit('hover', $event, subgroup.key)"
          @leave="$emit('leave', $event, subgroup.key)"
          @toggle-favorite="$emit('toggle-favorite', $event)"
        />
      </span>
    </div>
  </div>
</template>

<script>
import SidebarGroup from "./SidebarGroup.vue";

/**
 * Scrollable list of sidebar groups. Open, active and hovered state is owned
 * by the parent sidebar; group interactions are re-emitted with the group key.
 *
 * @author Carly Gettinger, Dennis Zyska, Nils Dycke, Andrii Nikitin
 */
export default {
  name: "SidebarGroupList",
  components: { SidebarGroup },
  props: {
    activeElementId: {
      type: [Number, String],
      default: null,
    },
    favoriteIds: {
      type: Array,
      default: () => [],
    },
    favoriteDisabled: {
      type: Boolean,
      default: false,
    },
    groups: {
      type: Array,
      required: true,
    },
    groupStates: {
      type: Object,
      required: true,
    },
    isCollapsed: {
      type: Boolean,
      default: false,
    },
    activeGroup: {
      type: String,
      default: null,
    },
    hoveredGroup: {
      type: String,
      default: null,
    },
  },
  emits: ["toggle", "hover", "leave", "toggle-favorite"],
};
</script>

<style>
.sidebar-scroll-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: visible;

  scrollbar-width: thin;
  scrollbar-color: rgba(120, 120, 120, 0.45) transparent;
}

.sidebar-scroll-area::-webkit-scrollbar {
  width: 6px;
}

.sidebar-scroll-area::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-scroll-area::-webkit-scrollbar-thumb {
  background: rgba(120, 120, 120, 0.35);
  border-radius: 999px;
  transition: background 0.2s ease;
}

.sidebar-scroll-area:hover::-webkit-scrollbar-thumb {
  background: rgba(120, 120, 120, 0.5);
}

.sidebar-scroll-area::-webkit-scrollbar-thumb:hover {
  background: rgba(120, 120, 120, 0.7);
}
</style>
