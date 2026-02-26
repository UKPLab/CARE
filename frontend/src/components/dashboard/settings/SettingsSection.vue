<template>
  <div class="card my-3">
    <div class="card-header step-card-header section-header" style="cursor: pointer" @click="toggleCollapse">
      <LoadIcon :icon-name="isCollapsed ? 'arrow-right-short' : 'arrow-down-short'" class="me-1" />
      {{ title }}
    </div>
    <div v-if="!isCollapsed" class="card-body mx-4 my-4">
      <template v-for="(subsection, idx) in visibleSubsections" :key="subsection.title || idx">
        <div class="mb-4">
          <h6 v-if="subsection.title" class="step-group-heading text-muted border-bottom pb-1 mb-3">{{ subsection.title }}</h6>
          <div
            v-for="key in subsection.keys"
            :key="key"
            class="form-group row my-2"
          >
            <SettingItem
              :setting="getSetting(key)"
              @update:value="(v) => setSettingValue(key, v)"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";
import SettingItem from "@/components/dashboard/settings/SettingItem.vue";

/**
 * SettingsSection - Renders a collapsible settings section with subsections.
 *
 * @param {string} title - Section heading (e.g. "General", "Mail")
 * @param {Array<{title: string, keys: string[]}>} subsections - Subsections with keys
 * @param {Array} settings - Flat array of setting objects
 */
export default {
  name: "SettingsSection",
  components: { LoadIcon, SettingItem },
  props: {
    title: { type: String, required: true },
    subsections: { type: Array, required: true },
    settings: { type: Array, default: () => [] },
    collapsed: { type: Boolean, default: true },
  },
  data() {
    return {
      isCollapsed: true,
    };
  },
  watch: {
    collapsed: {
      immediate: true,
      handler(val) {
        this.isCollapsed = val;
      },
    },
  },
  computed: {
    visibleSubsections() {
      return this.subsections;
    },
  },
  methods: {
    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed;
    },
    getSetting(key) {
      return this.settings.find((s) => s.key === key) || null;
    },
    setSettingValue(key, value) {
      const s = this.settings.find((x) => x.key === key);
      if (s) s.value = value;
    },
  },
};
</script>

<style scoped>
.step-group-heading {
  font-size: 1.1rem;
  font-weight: 600;
}

.step-card-header {
  font-size: 1.2rem;
  font-weight: 600;
}

.section-header {
  user-select: none;
}
</style>
