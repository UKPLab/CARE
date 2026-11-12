<template>
  <div class="care-filter" :class="{ 'is-open': isOpen }">
    <span v-if="label" :id="labelId" class="care-filter__label">{{ label }}</span>
    <button
      :id="buttonId"
      ref="button"
      type="button"
      class="care-filter__button"
      :class="{ 'is-active': isFiltered }"
      aria-haspopup="listbox"
      :aria-expanded="isOpen ? 'true' : 'false'"
      :aria-controls="listId"
      :aria-labelledby="label ? `${labelId} ${buttonId}` : undefined"
      @click="toggle"
      @keydown="onButtonKeydown"
    >
      <LoadIcon v-if="icon" class="care-filter__icon" :icon-name="icon" :size="13" />
      <span class="care-filter__value">{{ selectedLabel }}</span>
      <LoadIcon class="care-filter__chevron" icon-name="chevron-down" :size="11" />
    </button>

    <!-- Teleported so modal bodies with overflow do not clip the menu. Inside a modal it goes
         into the .modal element itself, otherwise Bootstrap's focus trap pulls focus back
         to the modal's close button. -->
    <Teleport :to="teleportTarget">
      <Transition name="care-filter-menu">
        <ul
          v-if="isOpen"
          :id="listId"
          ref="menu"
          class="care-menu care-filter__menu"
          role="listbox"
          tabindex="-1"
          :aria-labelledby="label ? labelId : buttonId"
          :aria-activedescendant="activeIndex >= 0 ? optionId(activeIndex) : undefined"
          :style="menuStyle"
          @keydown="onMenuKeydown"
        >
          <li
            v-for="(option, index) in options"
            :id="optionId(index)"
            :key="option.value"
            role="option"
            class="care-filter__option"
            :class="{ 'is-selected': isSelected(option), 'is-active': index === activeIndex }"
            :aria-selected="isSelected(option) ? 'true' : 'false'"
            @click="select(option)"
            @mousemove="activeIndex = index"
          >
            <span class="care-filter__option-label">{{ option.label }}</span>
            <LoadIcon v-if="isSelected(option)" class="care-filter__check" icon-name="check2" :size="13" />
          </li>
        </ul>
      </Transition>
    </Teleport>
  </div>
</template>

<script>
import {
  bindPopupListeners,
  createTypeahead,
  handleListboxKeydown,
  placePopup,
  popupTeleportTarget,
  uniqueId,
} from "@/basic/form/helpers/listbox";
import LoadIcon from "@/basic/Icon.vue";

/**
 * Styled single-choice filter dropdown (replacement for a native <select> in filter bars).
 *
 * Usage:
 * <BasicFilterDropdown
 *   v-model="workflowFilter"
 *   :label="$t('dashboard.study.filterWorkflows')"
 *   icon="diagram-3"
 *   :options="[{ value: 'all', label: 'All' }, { value: '3', label: 'Peer Review' }]"
 * />
 *
 * The first option is treated as the "no filter" value; any other choice highlights the button.
 * Keyboard: Enter/Space/ArrowDown opens, arrows/Home/End move, letters jump to an option,
 * Enter selects, Escape/Tab close.
 */
export default {
  name: "BasicFilterDropdown",
  components: {LoadIcon},
  props: {
    /** Currently selected value. */
    modelValue: {
      type: [String, Number],
      required: false,
      default: null,
    },
    /** Options as `{ value, label }`. */
    options: {
      type: Array,
      required: false,
      default: () => [],
    },
    /** Text shown before the button. */
    label: {
      type: String,
      required: false,
      default: "",
    },
    /** Bootstrap icon name without the `bi-` prefix. */
    icon: {
      type: String,
      required: false,
      default: "",
    },
    /** Value that means "no filter". Defaults to the first option. */
    defaultValue: {
      type: [String, Number],
      required: false,
      default: undefined,
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      isOpen: false,
      activeIndex: -1,
      menuStyle: {},
      teleportTarget: "body",
      uid: uniqueId(),
    };
  },
  computed: {
    buttonId() {
      return `care-filter-btn-${this.uid}`;
    },
    labelId() {
      return `care-filter-label-${this.uid}`;
    },
    listId() {
      return `care-filter-list-${this.uid}`;
    },
    selectedIndex() {
      return this.options.findIndex((o) => this.isSelected(o));
    },
    selectedLabel() {
      const option = this.options[this.selectedIndex];
      return option ? option.label : (this.options[0]?.label ?? "");
    },
    isFiltered() {
      const neutral = this.defaultValue !== undefined ? this.defaultValue : this.options[0]?.value;
      return this.modelValue !== null && String(this.modelValue) !== String(neutral);
    },
  },
  created() {
    this.typeahead = createTypeahead();
  },
  mounted() {
    this.teleportTarget = popupTeleportTarget(this.$el);
  },
  beforeUnmount() {
    this.unbindPopup?.();
  },
  methods: {
    optionId(index) {
      return `care-filter-opt-${this.uid}-${index}`;
    },
    isSelected(option) {
      return this.modelValue !== null && String(option.value) === String(this.modelValue);
    },
    toggle() {
      this.isOpen ? this.close() : this.open();
    },
    open() {
      if (this.isOpen || this.options.length === 0) return;
      this.activeIndex = this.selectedIndex >= 0 ? this.selectedIndex : 0;
      this.isOpen = true;
      this.updatePosition();
      this.$nextTick(() => {
        this.updatePosition();
        this.$refs.menu?.focus({ preventScroll: true });
        this.scrollActiveIntoView();
      });
      this.unbindPopup = bindPopupListeners({
        isInside: (target) => this.$refs.button?.contains(target) || this.$refs.menu?.contains(target),
        onOutside: () => this.close(false),
        onReposition: this.updatePosition,
      });
    },
    /**
     * @param {boolean} [focusButton] Return focus to the button.
     * @returns {void}
     */
    close(focusButton = true) {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.unbindPopup?.();
      this.unbindPopup = null;
      if (focusButton) {
        this.$refs.button?.focus({ preventScroll: true });
      }
    },
    select(option) {
      this.$emit("update:modelValue", option.value);
      this.close();
    },
    /** Pin the menu to the button. @returns {void} */
    updatePosition() {
      const button = this.$refs.button;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const margin = 12;
      const maxWidth = window.innerWidth - margin * 2;

      let width = Math.max(rect.width, 200);
      const menu = this.$refs.menu;
      if (menu) {
        const labels = menu.querySelectorAll(".care-filter__option-label");
        let text = 0;
        labels.forEach((el) => { text = Math.max(text, el.scrollWidth); });
        const option = menu.querySelector(".care-filter__option");
        const label = option?.querySelector(".care-filter__option-label");
        const extra = option && label
          ? option.getBoundingClientRect().width - label.getBoundingClientRect().width
          : 56;
        if (text > 0) width = Math.max(width, Math.ceil(text + extra + 2));
      }
      width = Math.min(width, maxWidth);

      const { style } = placePopup(rect, menu, { width, gap: 6, margin });
      this.menuStyle = { ...style, maxWidth: `${Math.round(maxWidth)}px` };
    },
    /**
     * @param {number} index
     * @returns {void}
     */
    setActive(index) {
      this.activeIndex = index;
      this.scrollActiveIntoView();
    },
    scrollActiveIntoView() {
      this.$nextTick(() => {
        const el = this.$refs.menu?.querySelector(".care-filter__option.is-active");
        el?.scrollIntoView({ block: "nearest" });
      });
    },
    onButtonKeydown(event) {
      if (["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        this.open();
      }
    },
    /**
     * Keys while the menu is open.
     * @param {KeyboardEvent} event
     * @returns {void}
     */
    onMenuKeydown(event) {
      handleListboxKeydown(event, {
        items: this.options,
        activeIndex: this.activeIndex,
        setActive: this.setActive,
        pick: (index) => this.select(this.options[index]),
        close: this.close,
        typeahead: this.typeahead,
      });
    },
  },
};
</script>

<style scoped>
.care-filter {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  flex-wrap: wrap;
}

.care-filter__label {
  font-size: .875rem;
  font-weight: 500;
  color: var(--bs-secondary-color);
}

.care-filter__button {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  max-width: 100%;
  min-height: 34px;
  padding: .3rem .7rem;
  font-size: .875rem;
  color: var(--bs-body-color);
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: var(--care-radius-md);
  cursor: pointer;
  transition: border-color var(--care-dur-fast) var(--care-ease),
              background-color var(--care-dur-fast) var(--care-ease),
              box-shadow var(--care-dur-fast) var(--care-ease);
}

.care-filter__button:hover {
  background: var(--care-hover);
}

.care-filter__button:focus-visible,
.care-filter.is-open .care-filter__button {
  outline: none;
  border-color: var(--care-primary);
  box-shadow: var(--care-focus-ring);
}

/* A non-default filter is visibly "on" */
.care-filter__button.is-active {
  border-color: color-mix(in srgb, var(--care-primary) 60%, var(--bs-border-color));
  background: color-mix(in srgb, var(--care-primary) 10%, var(--bs-body-bg));
}

.care-filter__icon {
  color: var(--bs-secondary-color);
}

.care-filter__button.is-active .care-filter__icon {
  color: var(--care-primary);
}

.care-filter__value {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.care-filter__chevron {
  color: var(--bs-secondary-color);
  transition: transform 160ms var(--care-ease);
}

.care-filter.is-open .care-filter__chevron {
  transform: rotate(180deg);
}

/* ---------- Menu (teleported to body) ---------- */
.care-filter__menu {
  max-width: calc(100vw - 24px);
  overflow-y: auto;
}

.care-filter__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
  padding: .45rem .65rem;
  font-size: .875rem;
  color: var(--bs-body-color);
  border-radius: var(--care-radius-sm);
  cursor: pointer;
  user-select: none;
}

.care-filter__option.is-active {
  background: var(--bs-tertiary-bg);
}

.care-filter__option.is-selected {
  font-weight: 500;
  color: var(--care-primary);
}

.care-filter__option-label {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.care-filter__check {
  flex: 0 0 auto;
}

.care-filter-menu-enter-active,
.care-filter-menu-leave-active {
  transition: opacity 120ms ease, transform 120ms var(--care-ease);
}

.care-filter-menu-enter-from,
.care-filter-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .care-filter-menu-enter-active,
  .care-filter-menu-leave-active,
  .care-filter__chevron {
    transition: none;
  }
}
</style>
