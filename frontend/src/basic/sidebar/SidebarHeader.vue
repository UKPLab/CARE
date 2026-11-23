<template>
  <div class="sidebar-header">
    <ul class="nav nav-tabs flex-grow-1">
      <li
          v-for="(config, slotName) in tabs"
          :key="slotName"
          class="nav-item"
      >
        <TopBarButton
            class="nav-link align-items-center"
            :class="{
            'active': activeSlot === slotName,
            'current-step': config.current,
          }"
            :aria-current="activeSlot === slotName ? 'page' : null"
            :title="config.title || ''"
            :aria-label="config.current ? $t('navigation.sidebar.currentStepTab', {title: config.title}) : (config.title || $t('navigation.sidebar.sidebarSection'))"
            :tabindex="single ? '-1' : '0'"
            :aria-disabled="single ? 'true' : 'false'"
            :disabled="single"
            @click="$emit('select', slotName)"
        >
          <span v-if="config.number" class="fw-semibold me-1">{{ config.number }}</span>
          <LoadIcon
              v-if="config.icon"
              :icon-name="config.icon"
              :size="20"
              :cursor="single ? 'default' : 'pointer'"
          />
        </TopBarButton>
      </li>
    </ul>

    <!-- Right side - action buttons (general + active slot) -->
    <div class="sidebar-buttons ms-2">
      <template v-if="buttons.length > 0">
        <TopBarButton
            v-for="button in visibleButtons"
            :key="button.action"
            :title="button.title"
            class="btn btn-sm sidebar-action-button"
            :disabled="button.disabled"
            @click="$emit('action', button.action, button)"
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
              :title="$t('common.moreActions')"
          >
            <LoadIcon
                icon-name="three-dots-vertical"
                :size="18"
                color="var(--bs-body-color)"
            />
          </TopBarButton>
          <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="sidebarDropdownButton">
            <li v-for="button in hiddenButtons" :key="button.action">
              <TopBarButton
                  class="dropdown-item"
                  :title="button.title"
                  :disabled="button.disabled"
                  @click="$emit('action', button.action, button)"
              >
                <LoadIcon
                    v-if="button.icon"
                    :icon-name="button.icon"
                    :size="16"
                    :color="button.disabled ? null : button.color"
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
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";
import TopBarButton from "@/basic/navigation/TopBarButton.vue";

/**
 * Header of BasicSidebar: one tab per sidebar slot, and the action buttons of the sidebar
 * and of the active tab (the ones past the limit go into a dropdown).
 */
export default {
  name: "SidebarHeader",
  components: {LoadIcon, TopBarButton},
  props: {
    /** Shown tabs by slot name: `{title, icon, number, current}` */
    tabs: {
      type: Object,
      required: true,
    },
    activeSlot: {
      type: String,
      required: false,
      default: null,
    },
    /** Buttons of the whole sidebar, shown before the active tab's own buttons */
    generalButtons: {
      type: Array,
      required: false,
      default: () => [],
    },
  },
  emits: ["select", "action"],
  data() {
    return {
      numberOfVisibleButtons: 4, //controls how many buttons are shown before collapsing into dropdown
    };
  },
  computed: {
    buttons() {
      return [...this.generalButtons, ...(this.tabs[this.activeSlot]?.buttons || [])];
    },
    single() {
      return Object.keys(this.tabs).length === 1;
    },
    visibleButtons() {
      // If 3 or fewer buttons, show all
      if (this.buttons.length <= this.numberOfVisibleButtons) {
        return this.buttons;
      }
      // If more than 3, show only first 2
      return this.buttons.slice(0, this.numberOfVisibleButtons - 1);
    },
    hiddenButtons() {
      // If 3 or fewer buttons, none are hidden
      if (this.buttons.length <= this.numberOfVisibleButtons) {
        return [];
      }
      // If more than 3, hide everything after first 2
      return this.buttons.slice(this.numberOfVisibleButtons - 1);
    },
  },
};
</script>

<style scoped src="./sidebar.css"></style>
