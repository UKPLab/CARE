<template>
  <div id="sidebarContainer" class="col border mh-100 col-sm-auto g-0">
    <div id="hoverHotZone"></div>
    <div id="sidebar" class="collapse collapse-horizontal border-end d-flex flex-column">
      <div id="hotZone" class="hot-zone"></div>
      <div id="sidepane" ref="sidepane">
        <div id="spacer"></div>
        <!-- Header with icon and tooltip -->
        <div v-if="Object.keys(sidebarConfigs).length" class="sidebar-header">
          <div v-for="(config, slotName) in sidebarConfigs" :key="slotName">
            <div
              class="icon-wrapper"
              :title="config.title || ''"
              role="img"
              :aria-label="config.title || 'Sidebar section'"
          >
            <LoadIcon
              v-if="config.icon"
              :icon-name="config.icon"
              :size="20"
              :color="isSingleConfig ? '#495057' : (resolvedActiveSlot === slotName ? '#0d6efd' : '#495057')"
              :cursor="isSingleConfig ? 'default' : 'pointer'"
              class="sidebar-icon"
              @click="isSingleConfig ? null : () => changeView(slotName)"
            />
            </div>
            <!-- <span
              v-if="sidebarConfigs[activeSlot]?.title"
              class="icon-hint"
              aria-hidden="true"
            >{{ sidebarConfigs[activeSlot].title }}</span> -->
          </div>
        </div>
        <!-- Dynamic slot content -->
        <div class="sidebar-content">
          <template v-for="slotName in availableSlots" :key="slotName">
            <div v-if="resolvedActiveSlot === slotName">
              <slot :name="slotName"/>
            </div>
          </template>
          <div v-if="!resolvedActiveSlot">
            <p>No sidebar content selected.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>

import LoadIcon from "@/basic/Icon.vue";

/** Sidebar component of the Editor
 *
 * The Sidebar can show different content based on dynamic slots with optional icons and titles.
 *
 * @author Dennis Zyska
 */
export default {
  name: "BasicSidebar",
  components: {LoadIcon},
  emits: ['sidebar-change'],
  props: {
    activeSideBar: {
      type: String,
      required: false,
      default: null,
    },
    sidebarConfigs: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      internalActiveSlot: this.activeSideBar || null
    };
  },
  computed: {
    availableSlots() {
      return Object.keys(this.$slots).filter(slot => slot !== 'default');
    },
    resolvedActiveSlot() {
      return this.internalActiveSlot || this.availableSlots[0] || null;
    },
    isSingleConfig() {
      return Object.keys(this.sidebarConfigs).length === 1;
    }
  },
  methods: {
    changeView(slotName) {
      const newSlot = this.resolvedActiveSlot === slotName ? null : slotName;
      this.internalActiveSlot = newSlot;
      
      // Emit slot change for parent component handling
      this.$emit('sidebar-change', newSlot);
    },
  }
};
</script>

<style scoped>
#sidebar {
  height: 100%;
  width: 100%;
  position: relative;
  /*transform: translateX(100%); lead to errors with the Configurator.vue*/
  transition: transform 0.3s ease;
  position: absolute;
}

#sidebar.is-active {
  transform: translateX(0);
}

#spacer {
  width: 400px;
  background-color: transparent;
}

#sidepane {
  padding-top: 5px;
  background-color: #e6e6e6;
  width: 100%;
  height: 100%;
  overflow-y: scroll;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  display: flex;
  align-items: left;
  justify-content: left;
  padding: 10px;
  border-bottom: 1px solid #ddd;
  background-color: #f8f9fa;
  flex-shrink: 0;
}

.sidebar-icon {
  margin-right: 8px;
}

.icon-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.icon-wrapper:focus .icon-hint,
.icon-wrapper:hover .icon-hint {
  opacity: 1;
  transform: translate(-50%, 0);
  pointer-events: auto;
}

.icon-hint {
  position: absolute;
  left: 50%;
  top: 110%;
  transform: translate(-50%, 4px);
  background: rgba(33, 37, 41, 0.92);
  color: #fff;
  font-size: 0.75rem;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 4px;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0,0,0,0.15);
  opacity: 0;
  transition: opacity .18s ease, transform .18s ease;
  pointer-events: none;
  z-index: 10;
}

.icon-hint:after {
  content: '';
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-bottom-color: rgba(33, 37, 41, 0.92);
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

#anno-list .list-group-i {
  border: none;
  background-color: transparent;
  margin-top: 4px;
  margin-left: 2px;
  margin-right: 2px;
}

#anno-list {
  list-style-type: none;
}

#addPageNote {
  padding-top: 1rem;
  text-align: center;
}

#addPageNote .btn {
  border: none;
  color: #575757;
}

#sidepane::-webkit-scrollbar {
  display: none;
}

.hot-zone {
  width: 3px;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  cursor: col-resize;
}

#sidebarContainer {
  position: relative;
  padding: 0;
  transition: width 0.3s ease;
  overflow-y: scroll;
}

#sidebarContainer.is-hidden {
  position: fixed;
  height: 100%;
  right: 0;
  width: 10px;
}

#sidebarContainer.is-hidden #hoverHotZone {
  display: block;
}

#sidebarContainer.is-dragging {
  transition: unset;
}

#sidebarContainer.is-fixed {
  position: fixed;
  right: 0;
}

#sidebarContainer.is-fixed .hot-zone {
  display: none;
}

#sidebarContainer::-webkit-scrollbar {
  display: none;
}

@media screen and (max-width: 900px) {
  #sidebarContainer {
    display: none;
  }
}

#hoverHotZone {
  position: fixed;
  height: 100%;
  width: 6px;
  top: 0;
  right: 0px;
  z-index: 999;
  display: none;
}
</style>
