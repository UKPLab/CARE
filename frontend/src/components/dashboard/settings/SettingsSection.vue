<template>
  <div class="card my-3">
    <div class="card-header step-card-header section-header" style="cursor: pointer" @click="toggleCollapse">
      <LoadIcon :icon-name="isCollapsed ? 'arrow-right-short' : 'arrow-down-short'" class="me-1" />
      {{ title }}
    </div>
    <div v-if="!isCollapsed" class="card-body mx-4 my-4">
      <template v-for="(subsection, idx) in visibleSubsections" :key="subsection.title || idx">
        <FormCollapsible
          v-if="subsection.title"
          :title="subsection.title"
          :collapsed="false"
          class="mb-3"
        >
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
        </FormCollapsible>
        <div v-else class="mb-4">
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
      <slot name="footer" />
    </div>
  </div>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";
import FormCollapsible from "@/basic/form/Collapsible.vue";
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
  components: { LoadIcon, FormCollapsible, SettingItem },
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
  computed: {
    visibleSubsections() {
      return this.subsections;
    },
  },
  watch: {
    collapsed: {
      immediate: true,
      handler(val) {
        this.isCollapsed = val;
      },
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
.step-card-header {
  font-size: 1.2rem;
  font-weight: 600;
}

.section-header {
  user-select: none;
}
</style>
