<template>
  <div class="anno-actions">
    <!-- Not teleported: AnnoCard moves focus to the next card only while focus is inside the
         card, and SideCard treats clicks outside the card as leaving an open edit. -->
    <BasicPopupMenu
      trigger-class="btn-sm anno-actions-trigger care-focus-ring"
      menu-class="anno-actions-menu"
      :placement="placement"
      :teleport="false"
    >
      <slot />
    </BasicPopupMenu>
  </div>
</template>

<script>
import BasicPopupMenu from "@/basic/PopupMenu.vue";

/**
 * "..." menu for a sidebar card. The slot keeps the existing action buttons.
 *
 * @param {String} placement - Side the menu opens on: "top" or "bottom"
 */
export default {
  name: "CardActions",
  components: { BasicPopupMenu },
  props: {
    placement: {
      type: String,
      required: false,
      default: "top",
    },
  },
  methods: {
    /**
     * Put focus on the "..." button (AnnoCard and Comment call this when an edit closes).
     * @returns {void}
     */
    focusTrigger() {
      this.$el.querySelector(".anno-actions-trigger")?.focus();
    },
  },
};
</script>

<style scoped>
.anno-actions {
  position: relative;
  display: flex;
  justify-content: flex-end;
}

/* The trigger and the menu are rendered by BasicPopupMenu, so these rules need :deep. */
.anno-actions :deep(.anno-actions-trigger) {
  border: 0;
  color: var(--bs-body-color);
}

.anno-actions :deep(.anno-actions-menu) {
  min-width: 11rem;
  display: flex;
  flex-direction: column;
  gap: .2rem;
  margin-top: 4px;
  padding: .4rem;
  border-radius: var(--care-radius-md);
  box-shadow: 0 8px 20px -8px rgb(var(--care-shadow-rgb) / .28);
}

.anno-actions :deep(.anno-actions-menu.is-up) {
  margin-top: -4px;
}

.anno-actions :deep(.anno-actions-menu button) {
  display: flex;
  align-items: center;
  gap: .55rem;
  width: 100%;
  margin: 0;
  padding: .5rem .7rem;
  border: 0;
  border-radius: var(--care-radius-sm);
  background: transparent;
  color: var(--bs-body-color);
  text-align: left;
  white-space: nowrap;
}

.anno-actions :deep(.anno-actions-menu button)::after {
  content: attr(title);
}

.anno-actions :deep(.anno-actions-menu button:not(:has(.visually-hidden)))::after {
  content: none;
}

.anno-actions :deep(.anno-actions-menu .visually-hidden) {
  display: none;
}

.anno-actions :deep(.anno-actions-menu button:hover) {
  background: var(--bs-tertiary-bg);
}

.anno-actions :deep(.anno-actions-menu .anno-action-danger) {
  color: var(--bs-danger);
}
</style>
