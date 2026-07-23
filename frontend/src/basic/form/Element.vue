<template>
  <fieldset :disabled="options.readOnly !== undefined ? options.readOnly : false" :class="{ 'shake': shake }">
    <div v-if="dataTable">
      <slot :id="options.key" :blur="validate" name="element"/>
      <div v-if="invalidField" class="feedback-invalid">
        <span v-if="options.invalidText"> {{ translateMaybeKey(options.invalidText) }}</span>
        <span v-else>{{$t('errors.element.invalidInput')}}</span>
      </div>
      <div v-else-if="options.required && emptyField" class="feedback-invalid">
        {{$t('errors.element.fieldRequired')}}
      </div>
    </div>
    <div v-else>
      <div
        v-if="'label' in options"
        class="d-flex justify-content-between align-items-center mb-1"
      >
        <div>
          <label
            :for="options.key"
            class="form-label mb-0"
          >{{ translateMaybeKey(options.label) }}</label>
          <FormHelp :help="translateMaybeKey(options.help)" />
        </div>
        <BasicButton
          v-if="options.labelButton"
          :icon="options.labelButton.icon"
          :title="options.labelButton.title"
          :text="options.labelButton.text"
          :tooltip="options.labelButton.tooltip"
          :disabled="options.labelButton.disabled || false"
          :class="options.labelButton.class"
          @click="handleLabelButtonClick"
        />
      </div>
      <FormHelp
        v-else
        :help="translateMaybeKey(options.help)"
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
        <span v-if="options.invalidText"> {{ translateMaybeKey(options.invalidText) }}</span>
        <span v-else>{{$t('errors.element.invalidInput')}}</span>
      </div>
      <div v-else-if="options.required && emptyField" class="feedback-invalid">
        {{$t('errors.element.fieldRequired')}}
      </div>
    </div>
  </fieldset>
</template>

<script>
import FormHelp from "@/basic/form/Help.vue"
import LoadIcon from "@/basic/Icon.vue";
import { translateMaybeKey } from "@/assets/utils";
import BasicButton from "@/basic/Button.vue";

/**
 * Basic form element with label and help text
 *
 * @author: Dennis Zyska
 */
export default {
  name: "BasicElement",
  components: {BasicButton, FormHelp, LoadIcon},
  inject: {
    formButtonClick: {
      default: null,
    },
  },
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
    translateMaybeKey,
    handleLabelButtonClick() {
      const payload = {
        key: this.options.key,
        action: this.options.labelButton?.action,
        field: this.options,
      };
      if (this.formButtonClick) {
        this.formButtonClick(payload);
      }
    },
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
          if (typeof data === "object" && data.ops && Array.isArray(data.ops)) {
            const hasText = data.ops.some(op => typeof op.insert === "string" && op.insert.trim() !== "");
            if (hasText) {
              this.emptyField = false;
              return true;
            }
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