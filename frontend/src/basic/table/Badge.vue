<template>
  <span
    v-tooltip="title && title.length > 0"
    :class="badgeClass"
    :title="title"
    class="badge"
    data-bs-html="true"
    data-bs-placement="top"
    data-bs-toggle="tooltip"
  >
    {{ text }}
  </span>
</template>

<script>
import {tooltip} from "@/assets/tooltip.js";

export default {
  name: "TableColumnBadge",
  directives: {
    'tooltip': tooltip
  },
  props: {
    value: {
      type: null,
      required: true
    },
    options: {
      type: Object,
      required: false,
      default: null
    }
  },
  computed: {
    badgeClass() {
      if(this.options && this.options.classMapping){
        return this.value in this.options.classMapping ? this.options.classMapping[this.value] : this.options.classMapping["default"];
      } else {
        return (this.value && this.value.class) ? this.value.class : 'bg-black';
      }
    },
    text() {
      if(this.options && this.options.keyMapping){
        return this.value in this.options.keyMapping ? this.options.keyMapping[this.value] : this.options.keyMapping["default"];
      } else {
        return this.value.text;
      }
    },
    title() {
      if(this.options && this.options.tooltip){
        return this.options.tooltip;
      } else if(this.value && this.value.tooltip){
        return this.value.tooltip;
      } else {
        return "";
      }
    }
  }
}
</script>

<style scoped>
/* Soft status pill: colour dot + subtle border on top of the global .badge colours. */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3em 0.65em 0.3em 0.55em;
  font-size: 0.74rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  border: 1px solid transparent;
  border-radius: 999px;
}

.badge::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.85;
}

.badge.bg-success {
  border-color: var(--bs-success-border-subtle);
}

.badge.bg-warning {
  border-color: var(--bs-warning-border-subtle);
}

.badge.bg-danger {
  border-color: var(--bs-danger-border-subtle);
}

.badge.bg-secondary {
  color: var(--bs-secondary-color);
  border-color: var(--bs-border-color-translucent);
}

/* Neutral-but-distinct state (e.g. a closed study); use via classMapping. */
.badge.badge-violet {
  color: rgb(var(--care-violet-rgb));
  background-color: rgba(var(--care-violet-rgb), 0.12);
  border-color: rgba(var(--care-violet-rgb), 0.25);
}
</style>