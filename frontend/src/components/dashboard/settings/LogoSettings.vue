<template>
  <div class="card my-3">
    <div class="card-header" style="cursor: pointer" @click="collapsed = !collapsed">
      <LoadIcon :icon-name="collapsed ? 'arrow-right-short' : 'arrow-down-short'" class="me-1" />
      logo
      <br>
      <span class="text-secondary"><small>Customise the logo RE section background colour</small></span>
    </div>
    <div v-if="!collapsed" class="card-body">
      <div class="card mt-3">
        <div class="card-body">
          <h5 class="card-title">logo.reBgColor</h5>
          <h6 class="card-subtitle mb-2 text-muted">Background colour for the RE section of the logo</h6>
          <div class="d-flex align-items-center gap-3 mt-2">
            <input
              :value="modelValue"
              type="color"
              class="form-control form-control-color"
              title="Pick a background colour"
              @input="$emit('update:modelValue', $event.target.value)"
            />
            <input
              :value="modelValue"
              type="text"
              class="form-control"
              style="max-width: 110px; font-family: monospace;"
              maxlength="7"
              @input="onHexInput"
            />
            <LogoSvg :height="40" :re-bg-color="modelValue" />
            <button
              class="btn btn-outline-secondary btn-sm"
              :disabled="modelValue.toLowerCase() === DEFAULT_RE_BG"
              @click="$emit('update:modelValue', DEFAULT_RE_BG)"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * Settings panel for customising the logo RE-section background colour.
 * Provides a colour picker, hex text input, live preview, and a reset button.
 *
 * @author Akash Gundapuneni
 */
import LogoSvg, { DEFAULT_RE_BG } from "@/basic/icon/LogoSvg.vue";
import LoadIcon from "@/basic/Icon.vue";

export default {
  name: "LogoSettings",
  components: { LogoSvg, LoadIcon },
  props: {
    modelValue: { type: String, required: true },
  },
  emits: ["update:modelValue"],
  data() {
    return { collapsed: true, DEFAULT_RE_BG };
  },
  methods: {
    onHexInput(e) {
      let v = e.target.value;
      if (v && !v.startsWith("#")) v = "#" + v;
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        this.$emit("update:modelValue", v);
      }
    },
  },
};
</script>
