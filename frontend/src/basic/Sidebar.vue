<template>
  <div
      v-show="isSidebarVisible"
      id="sidebarContainer"
      class="sidebar-wrapper"
      :class="sidebarClasses"
      :style="sidebarStyle"
  >
    <div id="hoverHotZone"></div>
    <div id="sidebar" class="sidebar border-end d-flex flex-column">
      <div id="hotZone" class="hot-zone"></div>
      <div id="sidepane" ref="sidepane">
        <div id="spacer"></div>
        <div v-if="sidebarConfigs" class="sidebar-header">
          <ul class="nav nav-tabs flex-grow-1">
            <li
                v-for="(config, slotName) in sidebarConfigs.tabs"
                :key="slotName"
                class="nav-item"
            >
              <TopBarButton
                  class="nav-link align-items-center"
                  :class="{
                  'active': resolvedActiveSlot === slotName,
                }"
                  :aria-current="resolvedActiveSlot === slotName ? 'page' : null"
                  :title="config.title || ''"
                  :aria-label="config.title || 'Sidebar section'"
                  :tabindex="isSingleConfig ? '-1' : '0'"
                  :aria-disabled="isSingleConfig ? 'true' : 'false'"
                  :disabled="isSingleConfig"
                  @click="changeView(slotName)"
              >
                <LoadIcon
                    v-if="config.icon"
                    :icon-name="config.icon"
                    :size="20"
                    :color="isSingleConfig ? '#495057' : (resolvedActiveSlot === slotName ? '#0d6efd' : '#495057')"
                    :cursor="isSingleConfig ? 'default' : 'pointer'"
                />
              </TopBarButton>
            </li>
          </ul>

          <!-- Right side - action buttons (general + active slot) -->
          <div class="sidebar-buttons ms-2">
            <template v-if="combinedButtons.length > 0">
              <TopBarButton
                  v-for="button in visibleButtons"
                  :key="button.action"
                  :title="button.title"
                  class="btn btn-sm sidebar-action-button"
                  @click="handleButtonAction(button.action, button)"
                  :disabled="button.disabled"
              >
                <LoadIcon
                    v-if="button.icon"
                    :icon-name="button.icon"
                    :size="18"
                    :color="button.color"
                />
              </TopBarButton>

              <!-- Dropdown for additional buttons when more than limit -->
              <div v-if="hiddenButtons.length > 0" class="dropdown">
                <TopBarButton
                    id="sidebarDropdownButton"
                    class="btn btn-sm sidebar-action-button dropdown-toggle"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                    title="More actions"
                >
                  <LoadIcon
                      icon-name="three-dots-vertical"
                      :size="18"
                      color="#495057"
                  />
                </TopBarButton>
                <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="sidebarDropdownButton">
                  <li v-for="button in hiddenButtons" :key="button.action">
                    <TopBarButton
                        class="dropdown-item"
                        :title="button.title"
                        :disabled="button.disabled"
                        @click="handleButtonAction(button.action, button)"
                    >
                      <LoadIcon
                          v-if="button.icon"
                          :icon-name="button.icon"
                          :size="16"
                          :color="button.disabled ? '#6c757d' : (button.color || '#495057')"
                          class="me-2"
                      />
                      {{ button.title }}
                    </TopBarButton>
                  </li>
                </ul>
              </div>
            </template>
          </div>
        </div>
        <!-- Dynamic slot content -->
        <div class="sidebar-content">
          <template v-for="slotName in availableSlots" :key="slotName">
            <keep-alive>
              <div v-show="resolvedActiveSlot === slotName">
                <slot :name="slotName"/>
              </div>
            </keep-alive>
          </template>
          <div v-if="!resolvedActiveSlot">
            <p>No sidebar content selected.</p>
          </div>
        </div>
      </div>
    </div>
    <Teleport to="#topBarNavItems">
      <li class="nav-item">
        <TopBarButton
            v-show="studySessionId && studySessionId !== 0 ? showToggleButton : true"
            :title="isSidebarVisible ? 'Hide sidebar' : 'Show sidebar'"
            class="btn rounded-circle"
            :class="{ 'sidebar-highlight': sidebarIconHighlight }"
            @click="toggleSidebar"
        >
          <LoadIcon
              :icon-name="isSidebarVisible ? 'layout-sidebar-inset-reverse' : 'layout-sidebar-reverse'"
              :size="18"
          />
        </TopBarButton>
      </li>
    </Teleport>
  </div>
</template>

<script>

import { scrollElement } from "@/assets/anchoring/scroll";
import LoadIcon from "@/basic/Icon.vue";
import TopBarButton from "@/basic/navigation/TopBarButton.vue";
import debounce from "lodash.debounce";

/** BasicSidebar component
 *      sidebarWidth: 400,

 * A reusable sidebar component that can display different content based on dynamic slots
 * with optional icons, titles, and configurable action buttons.
 *
 * @author Karim Ouf
 */
export default {
  name: "BasicSidebar",
  components: {LoadIcon, TopBarButton},
  props: {
    activeSideBar: {
      type: String,
      required: false,
      default: null,
    },
    buttons: {
      type: Array,
      default: () => ([])
    },
    maxSidebarWidth: {
      type: Number,
      required: false,
      default: 400
    },
    minSidebarWidth: {
      type: Number,
      required: false,
      default: 0
    },
    showToggleButton: {
      type: Boolean,
      required: false,
      default: true
    },
  },
  emits: ['sidebar-change', 'sidebar-action', 'resize', 'sidebar-visibility-change'],
  inject: {
    studySessionId: {
      type: Number,
      required: false,
      default: null
    },
    studyStepId: {
      type: Number,
      required: false,
      default: null
    },
    documentId: {
      type: Number,
      required: false,
      default: null
    },
    acceptStats: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  data() {
    return {
      internalActiveSlot: null,
      width: 400,
      minWidth: 200,
      maxWidth: 800,
      sidebarWidth: 400,
      isSidebarVisible: true,
      sidebarIconHighlight: false,
      numberOfVisibleButtons: 4, //controls how many buttons are shown before collapsing into dropdown
      isFixed: false,
      isDragging: false,
      sidebarContainerDom: undefined,
      originalWidth: undefined
    };
  },
  mounted() {
    // Initialize width properties from props after component is mounted
    this.width = this.sidebarWidth;
    this.minWidth = this.minSidebarWidth;
    this.maxWidth = this.maxSidebarWidth;
    this.originalWidth = this.width;
    this.internalActiveSlot = this.activeSideBar || null;

    this.initDragController();
    this.initHoverController();
    this.onResize();
    window.addEventListener('resize', this.onResize);

    // Emit the current active sidebar view after mount
    this.$emit('sidebar-change', this.resolvedActiveSlot);

    //TODO adapt both eventbus to one generic eventbus
    // "sidebarActiveView" with parameter to where to switch
    // this is then e.g. called when a manual annotation is added
      // When a manual annotation is added, automatically switch to the annotator sidebar
    this.eventBus.on('annotator:switchToSidebar', () => {
      if (this.assessmentEnabled && this.assessmentViewActive) {
        this.assessmentViewActive = false;
        this.isSidebarVisible = true;
      }
    });

    // When a manual annotation is added, automatically switch to the annotator sidebar
    this.eventBus.on('annotator:switchToSidebar', () => {
      if (this.assessmentEnabled && this.assessmentViewActive) {
        this.assessmentViewActive = false;
        this.isSidebarVisible = true;
      }
    });

  },
  beforeUnmount() {
    window.removeEventListener('resize', this.onResize);
  },
  watch: {
    isSidebarVisible(newVal) {
      if (newVal) {
        this.width = this.originalWidth;
        this.isFixed = false;
        this.isHovering = false;
      }
    }
  },
  computed: {
    availableSlots() {
      return Object.keys(this.$slots).filter(slot => slot !== 'default');
    },
    sidebarConfigs() {
      const configs = {tabs: {}, buttons: []};
      this.availableSlots.forEach(slotName => {
        const slot = this.$slots[slotName];
        if (slot) {
          const vnodes = slot();
          const firstVNode = vnodes[0];
          if (firstVNode) {
            let props = firstVNode.props || {};
            if (slotName === "additionalSidebars" || !props.title) {
              props = vnodes[0].children[0].props || {};
            }
            configs.tabs[slotName] = {
              title: props.title,
              icon: props.icon,
              buttons: props.buttons || []
            };
          }
        }
      });
      // Add general buttons from props
      if (this.buttons && this.buttons.length > 0) {
        configs.buttons = this.buttons.filter(btn => btn.isGeneral);
      }
      return configs;
    },
    combinedButtons() {
      let buttons = [];
      // Add general buttons (not tied to a specific slot)
      if (this.sidebarConfigs && this.sidebarConfigs.buttons) {
        buttons = buttons.concat(this.sidebarConfigs.buttons);
      }
      // Add buttons for the active slot
      if (this.activeSlotConfig && this.activeSlotConfig.buttons) {
        buttons = buttons.concat(this.activeSlotConfig.buttons);
      }
      return buttons;
    },
    visibleButtons() {
      // If 3 or fewer buttons, show all
      if (this.combinedButtons.length <= this.numberOfVisibleButtons) {
        return this.combinedButtons;
      }
      // If more than 3, show only first 2
      return this.combinedButtons.slice(0, this.numberOfVisibleButtons - 1);
    },
    hiddenButtons() {
      // If 3 or fewer buttons, none are hidden
      if (this.combinedButtons.length <= this.numberOfVisibleButtons) {
        return [];
      }
      // If more than 3, hide everything after first 2
      return this.combinedButtons.slice(this.numberOfVisibleButtons - 1);
    },
    resolvedActiveSlot() {
      console.log(this.internalActiveSlot);
      return this.internalActiveSlot || this.availableSlots[0] || null;
    },
    isSingleConfig() {
      return Object.keys(this.sidebarConfigs.tabs).length === 1;
    },
    activeSlotConfig() {
      return this.resolvedActiveSlot ? this.sidebarConfigs.tabs[this.resolvedActiveSlot] : null;
    },
    sidebarStyle() {
      return {
        width: this.isSidebarVisible ? `${this.width}px` : '0px',
        maxWidth: `${this.width}px`,
        minWidth: this.isSidebarVisible ? `${this.width}px` : '0px',
        flexShrink: 0,
        transition: this.isDragging ? 'none' : 'all 0.3s ease-in-out'
      };
    },
    sidebarClasses() {
      return {
        'sidebar-visible': this.isSidebarVisible,
        'sidebar-hidden': !this.isSidebarVisible,
        'border': this.isSidebarVisible,
        'mh-100': true
      };
    }
  },
  methods: {
    changeView(slotName) {
      if (this.isSingleConfig || this.resolvedActiveSlot === slotName) return;
      const newSlot = slotName;
      this.internalActiveSlot = newSlot;

      // Emit slot change for parent component handling
      this.$emit('sidebar-change', newSlot);
    },
    toggleSidebar() {
      this.isSidebarVisible = !this.isSidebarVisible;
      this.sidebarWidth = this.isSidebarVisible ? 400 : 0;
    },
    async scrollTo(offset) {
      await scrollElement(this.$refs.sidepane, offset);
    },

    /**
     * Handle button action click
     * @param {string} action - The action name from button config
     * @param {object} button - The full button configuration
     */
    handleButtonAction(action, button) {
      this.$emit('sidebar-action', {
        action: action,
        slotName: this.resolvedActiveSlot,
        button: button
      });
    },

    /**
     * Initializes the drag controller for the sidebar
     *
     * When the mouse is pressed on the hot zone, the sidebar can be resized
     *
     * @author Zheyu Zhang
     */
    initDragController() {
      const dom = document.querySelector('#hotZone');
      const that = this;

      let startX, startWidth;
      const handleStart = (e) => {
        that.isDragging = true;

        e.preventDefault();
        document.body.style.userSelect = 'none';

        startWidth = this.width;
        startX = e.clientX;
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);
      }

      const handleMove = (e) => {
        e.preventDefault();
        let newWidth = startWidth - (e.clientX - startX);
        const maxWidthInPixels = window.innerWidth * this.maxWidth / 100;
        newWidth = Math.max(newWidth, this.minWidth);
        newWidth = Math.min(newWidth, maxWidthInPixels);
        this.width = newWidth;
      }

      const handleEnd = () => {
        that.isDragging = false;

        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleEnd);
        document.body.style.userSelect = '';

        this.$socket.emit("appSettingSet", {key: "sidebar.width", value: this.width});
        this.originalWidth = this.width;
      }

      dom.addEventListener('mousedown', handleStart);
    },
    /**
     * Initializes the hover controller for the sidebar
     *
     * When the mouse enters the hover zone, the sidebar will be fixed
     *
     * @author Zheyu Zhang
     */
    initHoverController() {
      const hoverHotZoneDom = document.querySelector('#hoverHotZone');
      this.sidebarContainerDom = document.querySelector('#sidebarContainer');
      let hoverTimer;

      hoverHotZoneDom.addEventListener('mouseenter', () => {
        hoverTimer = setTimeout(() => {
          this.isFixed = true;
          this.width = this.minWidth;
          this.isHovering = true;
          this.sidebarContainerDom.addEventListener('mouseleave', handleMouseleave);
        }, 500);
      });

      const handleMouseleave = () => {
        clearTimeout(hoverTimer);
        this.width = this.originalWidth;
        this.isFixed = false;
        this.isHovering = false;
        this.sidebarContainerDom.removeEventListener('mouseleave', handleMouseleave);
      };

      hoverHotZoneDom.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimer);
      });
    },
    /**
     * Registers the sidebar blur event
     *
     * @author Zheyu Zhang
     */
    registerSidebarBlurEvent() {
      const handleSidebarClick = (e) => {
        e.stopPropagation();
      };

      const handleBodyClick = () => {
        this.isFixed = false;
        this.isHovering = false;
        document.body.removeEventListener("click", handleBodyClick);
      };

      this.sidebarContainerDom.addEventListener("click", handleSidebarClick);
      document.body.addEventListener("click", handleBodyClick);
    },
    onCopy(event) {
      this.$emit('copy', event);
    },
    onResize() {
      if (window.innerWidth <= 900) {
        this.isSidebarVisible = false;
        this.sidebarIconHighlight = true;
        setTimeout(() => {
          this.sidebarIconHighlight = false;
        }, 1000);
        this.visibilityChange();
      } else if (window.innerWidth > 900) {
        this.isSidebarVisible = true;
      }

      // Log resize event with debouncing
      this.logResize();
    },
    visibilityChange() {
      this.$emit('sidebar-visibility-change', this.isSidebarVisible);
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "sidebar-visibility",
          data: {
            isSidebarVisible: this.isSidebarVisible,
            documentId: this.documentId,
            studySessionId: this.studySessionId,
            studyStepId: this.studyStepId,
          }
        });
      }
    },
    logResize: debounce(function () {
        if (this.acceptStats) {
          this.$socket.emit("stats", {
            action: "sidebarResize",
            data: {
              documentId: this.documentId,
              studySessionId: this.studySessionId,
              studyStepId: this.studyStepId,
              windowWidth: window.innerWidth,
              sidebarVisible: this.isSidebarVisible
            }
          });
        }
      }, 500)
  },
};
</script>

<style scoped>
/* ===== MAIN CONTAINER STYLES ===== */
.sidebar-wrapper {
  position: relative;
  background-color: #f8f9fa;
  border-left: 1px solid #ddd;
  flex-shrink: 0;
}

.sidebar-wrapper.sidebar-visible {
  opacity: 1;
}

.sidebar-wrapper.sidebar-hidden {
  opacity: 0;
  pointer-events: none;
}

#sidebarContainer {
  position: relative;
  padding: 0;
  transition: width 0.3s ease;
}

#sidebarContainer::-webkit-scrollbar {
  display: none;
}

/* ===== SIDEBAR CONTENT LAYOUT ===== */
.sidebar {
  flex: 1;
  height: 100%;
  width: 100%;
  position: relative;
  overflow-y: hidden;
}

.sidebar-content {
  height: 100%;
  overflow-y: scroll;
}

#sidepane {
  background-color: #e6e6e6;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

#spacer {
  background-color: transparent;
}

/* ===== HEADER SECTION ===== */
.sidebar-header {
  display: flex;
  align-items: stretch;
  padding: 10px;
  border-bottom: 1px solid #ddd;
  background-color: #ffff;
  flex-shrink: 0;
}

.sidebar-header .nav-tabs {
  border-bottom: none;
  margin-bottom: 0;
}

.sidebar-header .nav-tabs .nav-link {
  border: 1px solid transparent;
  border-radius: 0.375rem 0.375rem 0 0;
  padding: 8px 8px;
  color: #495057;
  transition: all 0.2s ease-in-out;
}

.sidebar-header .nav-tabs .nav-link:hover {
  border-color: #e9ecef #e9ecef #dee2e6;
  background-color: #f8f9fa;
}

.sidebar-header .nav-tabs .nav-link.active {
  color: #0d6efd;
  background-color: #fff;
  border-color: #dee2e6 #dee2e6 #fff;
}

.sidebar-header .nav-tabs .nav-link.disabled {
  color: #6c757d;
  background-color: transparent;
  border-color: transparent;
  cursor: not-allowed;
}

.sidebar-buttons {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sidebar-buttons .dropdown {
  position: relative;
}

/* ===== BUTTON STYLES ===== */
.sidebar-action-button {
  position: relative;
  border-radius: 6px !important;
  transition: all 0.2s ease-in-out;
}

.sidebar-action-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
  background-color: #f8f9fa !important;
  border-color: #dee2e6 !important;
}

.sidebar-action-button:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
}

.sidebar-action-button.disabled {
  opacity: 0.6;
  cursor: not-allowed !important;
  transform: none !important;
  box-shadow: none !important;
}

.sidebar-action-button.disabled:hover {
  transform: none !important;
  box-shadow: none !important;
  background-color: inherit !important;
  border-color: inherit !important;
}

/* ===== DROPDOWN STYLES ===== */
.dropdown-menu {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 4px
}

.dropdown-item:hover {
  background-color: #f8f9fa;
  transform: translateY(-1px);
  transition: all 0.2s ease;
}

.dropdown-toggle::after {
  display: none;
}

#addPageNote {
  padding-top: 1rem;
  text-align: center;
}

#addPageNote .btn {
  border: none;
  color: #575757;
}

.nav-text {
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Hide text on smaller screens, show only icons */
@media (max-width: 768px) {
  .nav-text {
    display: none;
  }

  .sidebar-header .nav-tabs .nav-link {
    padding: 8px;
  }
}

/* ===== CONTENT AREA STYLES ===== */

#anno-list {
  list-style-type: none;
}

#anno-list .list-group-i {
  border: none;
  background-color: transparent;
  margin-top: 4px;
  margin-left: 2px;
  margin-right: 2px;
}

/* ===== DRAG & RESIZE FUNCTIONALITY ===== */
.hot-zone {
  width: 5px;
  background-color: transparent;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  cursor: col-resize;
  z-index: 2;
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

/* ===== SIDEBAR STATES ===== */
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

/* ===== RESPONSIVE STYLES ===== */
/* @media screen and (max-width: 900px) {
  #sidebarContainer {
    display: none;
  }
} */
</style>
