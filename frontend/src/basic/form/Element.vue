<template>
  <fieldset :disabled="options.readOnly !== undefined ? options.readOnly : false" :class="{ 'shake': shake }">
    <div v-if="dataTable">
      <slot :id="options.key" :blur="validate" name="element"/>
      <div v-if="invalidField" class="feedback-invalid">
        <span v-if="options.invalidText"> {{ options.invalidText }}</span>
        <span v-else>The input is invalid.</span>
      </div>
      <div v-else-if="options.required && emptyField" class="feedback-invalid">
        This field is required.
      </div>
    </div>
    <div v-else>
      <label
        v-if="'label' in options"
        :for="options.key"
        class="form-label"
      >{{ options.label }}</label>
      <FormHelp
        :help="options.help"
      />
      <div class="input-group">
        <div
          v-if="'icon' in options"
          class="input-group-text"
        >
          <LoadIcon
            :icon-name="options.icon"
            :size="16"
          />
        </div>
        <slot :id="options.key" :blur="validate" name="element"/>

      </div>
      <div v-if="invalidField" class="feedback-invalid">
        <span v-if="options.invalidText"> {{ options.invalidText }}</span>
        <span v-else>The input is invalid.</span>
      </div>
      <div v-else-if="options.required && emptyField" class="feedback-invalid">
        This field is required.
      </div>
    </div>
  </fieldset>
</template>

<script>
import FormHelp from "@/basic/form/Help.vue"
import LoadIcon from "@/basic/Icon.vue";

/**
 * Basic form element with label and help text
 *
 * @author: Dennis Zyska
 */
export default {
  name: "BasicElement",
  components: {FormHelp, LoadIcon},
  props: {
    options: {
      type: Object,
      required: true
    },
    dataTable: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  data() {
    return {
      invalidField: false,
      emptyField: false,
      shake: false,
    }
  },
  mounted() {
    this.eventBus.on('resetFormField', this.resetFieldState)
  },
  beforeUnmount() {
    this.eventBus.off('resetFormField', this.resetFieldState)
  },
  methods: {
    validate(data) {
      if (data === true) {
        this.invalidField = false;
        return true;
      }
      if (this.options.required) {
        // Check pattern
        if (this.options.pattern) {
          if (new RegExp(this.options.pattern).test(data)) {
            this.invalidField = false;
            return true;
          } else {
            this.invalidField = true;
            return false;
          }
        }
        this.invalidField = false;
        // Check empty
        if (data) {
          if(typeof data === "string" && data !== "") {
            this.emptyField = false;
            return true;
          }
          if(Array.isArray(data) && data.length !== 0 ) {
            this.emptyField = false;
            return true;
          }
          if(typeof data === "number")  {
            this.emptyField = false;
            return true;
          }
          this.emptyField = true;
          this.shakeIt();
          return false;
        } else {
          this.emptyField = true;
          this.shakeIt();
          return false;
        }
      } else {
        return true;
      }
    },
    shakeIt() {
      this.shake = true;
      setTimeout(() => {
        this.shake = false;
      }, 1500);
    },
    resetFieldState () {
      this.invalidField = false;
      this.emptyField = false;
    }
  }
}
</script>

<style scoped>
.feedback-invalid {
  font-size: 0.75em;
  color: firebrick;
  padding-top: 4px;
  padding-left: 5px;
}

@keyframes shake-animation {
  0% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  50% { transform: translateX(5px); }
  75% { transform: translateX(-5px); }
  100% { transform: translateX(0); }
}

.shake {
  animation: shake-animation 0.5s ease-in-out;
}
</style>