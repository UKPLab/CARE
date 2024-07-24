<template>
  <fieldset :disabled="options.readOnly !== undefined ? options.readOnly : false">
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
      emptyField: false
    }
  },
  methods: {
    validate(data) {
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
        if (data && data !== "") {
          this.emptyField = false;
          return true;
        } else {
          this.emptyField = true;
          return false;
        }

      } else {
        return true;
      }

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
</style>