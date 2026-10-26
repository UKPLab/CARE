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
      <i v-if="icon" :class="`bi bi-${icon}`" class="care-filter__icon" aria-hidden="true"></i>
      <span class="care-filter__value">{{ selectedLabel }}</span>
      <i class="bi bi-chevron-down care-filter__chevron" aria-hidden="true"></i>
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
          class="care-filter__menu"
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
            <i v-if="isSelected(option)" class="bi bi-check2 care-filter__check" aria-hidden="true"></i>
          </li>
        </ul>
      </Transition>
    </Teleport>
  </div>
</template>

<script>
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
 * Keyboard: Enter/Space/ArrowDown opens, arrows/Home/End move, Enter selects, Escape/Tab close.
 */
export default {
  name: "BasicFilterDropdown",
  props: {
    /** Currently selected value. */
    modelValue: {
      type: [String, Number],
      default: null,
    },
    /** Options as `{ value, label }`. */
    options: {
      type: Array,
      default: () => [],
    },
    /** Text shown before the button. */
    label: {
      type: String,
      default: "",
    },
    /** Bootstrap icon name without the `bi-` prefix. */
    icon: {
      type: String,
      default: "",
    },
    /** Value that means "no filter". Defaults to the first option. */
    defaultValue: {
      type: [String, Number],
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
    };
  },
  computed: {
    uid() {
      return this.$.uid;
    },
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
  mounted() {
    this.teleportTarget = this.$el.closest?.(".modal") || "body";
  },
  beforeUnmount() {
    this.removeListeners();
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
        this.$refs.menu?.focus({ preventScroll: true });
        this.scrollActiveIntoView();
      });
      document.addEventListener("pointerdown", this.onOutsidePointer, true);
      window.addEventListener("resize", this.updatePosition);
      window.addEventListener("scroll", this.updatePosition, true);
    },
    close(focusButton = true) {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.removeListeners();
      if (focusButton) {
        this.$refs.button?.focus({ preventScroll: true });
      }
    },
    removeListeners() {
      document.removeEventListener("pointerdown", this.onOutsidePointer, true);
      window.removeEventListener("resize", this.updatePosition);
      window.removeEventListener("scroll", this.updatePosition, true);
    },
    select(option) {
      this.$emit("update:modelValue", option.value);
      this.close();
    },
    updatePosition() {
      const button = this.$refs.button;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(160, Math.min(320, openUp ? spaceAbove : spaceBelow));
      this.menuStyle = {
        left: `${Math.round(rect.left)}px`,
        minWidth: `${Math.round(Math.max(rect.width, 200))}px`,
        maxHeight: `${Math.round(maxHeight)}px`,
        ...(openUp
          ? { bottom: `${Math.round(window.innerHeight - rect.top + 6)}px` }
          : { top: `${Math.round(rect.bottom + 6)}px` }),
      };
    },
    onOutsidePointer(event) {
      const inButton = this.$refs.button?.contains(event.target);
      const inMenu = this.$refs.menu?.contains(event.target);
      if (!inButton && !inMenu) {
        this.close(false);
      }
    },
    moveActive(delta) {
      const count = this.options.length;
      if (!count) return;
      this.activeIndex = (this.activeIndex + delta + count) % count;
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
    onMenuKeydown(event) {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          this.moveActive(1);
          break;
        case "ArrowUp":
          event.preventDefault();
          this.moveActive(-1);
          break;
        case "Home":
          event.preventDefault();
          this.activeIndex = 0;
          this.scrollActiveIntoView();
          break;
        case "End":
          event.preventDefault();
          this.activeIndex = this.options.length - 1;
          this.scrollActiveIntoView();
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          if (this.options[this.activeIndex]) {
            this.select(this.options[this.activeIndex]);
          }
          break;
        case "Escape":
          event.preventDefault();
          event.stopPropagation(); // do not close a surrounding modal
          this.close();
          break;
        case "Tab":
          this.close(false);
          break;
      }
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
  border-radius: var(--bs-border-radius, .5rem);
  cursor: pointer;
  transition: border-color var(--care-dur-fast, 120ms) var(--care-ease, ease),
              background-color var(--care-dur-fast, 120ms) var(--care-ease, ease),
              box-shadow var(--care-dur-fast, 120ms) var(--care-ease, ease);
}

.care-filter__button:hover {
  background: var(--bs-tertiary-bg);
}

.care-filter__button:focus-visible,
.care-filter.is-open .care-filter__button {
  outline: none;
  border-color: var(--care-primary, var(--bs-primary));
  box-shadow: var(--care-focus-ring, 0 0 0 3px rgb(13 110 253 / .35));
}

/* A non-default filter is visibly "on" */
.care-filter__button.is-active {
  border-color: color-mix(in srgb, var(--care-primary, var(--bs-primary)) 60%, var(--bs-border-color));
  background: color-mix(in srgb, var(--care-primary, var(--bs-primary)) 10%, var(--bs-body-bg));
}

.care-filter__icon {
  color: var(--bs-secondary-color);
}

.care-filter__button.is-active .care-filter__icon {
  color: var(--care-primary, var(--bs-primary));
}

.care-filter__value {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.care-filter__chevron {
  font-size: .7rem;
  color: var(--bs-secondary-color);
  transition: transform 160ms var(--care-ease, ease);
}

.care-filter.is-open .care-filter__chevron {
  transform: rotate(180deg);
}

/* ---------- Menu (teleported to body) ---------- */
.care-filter__menu {
  position: fixed;
  z-index: 1080; /* above Bootstrap modals (1055) */
  max-width: min(420px, calc(100vw - 24px));
  margin: 0;
  padding: .25rem;
  overflow-y: auto;
  list-style: none;
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color-translucent);
  border-radius: var(--bs-border-radius-lg, .75rem);
  box-shadow: var(--care-shadow-3, 0 12px 24px -6px rgb(0 0 0 / .2));
  outline: none;
}

.care-filter__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
  padding: .45rem .65rem;
  font-size: .875rem;
  color: var(--bs-body-color);
  border-radius: var(--bs-border-radius-sm, .375rem);
  cursor: pointer;
  user-select: none;
}

.care-filter__option.is-active {
  background: var(--bs-tertiary-bg);
}

.care-filter__option.is-selected {
  font-weight: 500;
  color: var(--care-primary, var(--bs-primary));
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
  transition: opacity 120ms ease, transform 120ms var(--care-ease, ease);
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
