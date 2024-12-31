<template>
  <BasicForm
    ref="form"
    v-model="moodleOptions"
    :fields="moodleOptionsFields"
  />
</template>

<script>
import { defineComponent } from "vue";
import BasicForm from "@/basic/Form.vue";

export default defineComponent({
  components: { BasicForm },
  props: {
    withAssignmentId: {
      type: Boolean,
      default: false,
    },
    modelValue: {
      type: Object,
      required: false,
      default: () => {
        return {};
      },
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      moodleOptions: {},
    };
  },
  computed: {
    moodleCourseId() {
      return parseInt(this.$store.getters["settings/getValue"]("rpc.moodleAPI.courseID"));
    },
    showMoodleCourseId() {
      return this.$store.getters["settings/getValue"]("rpc.moodleAPI.showInput.courseID") === "true";
    },
    moodleAPIKey() {
      return this.$store.getters["settings/getValue"]("rpc.moodleAPI.apiKey");
    },
    showMoodleAPIKey() {
      return this.$store.getters["settings/getValue"]("rpc.moodleAPI.showInput.apiKey") === "true";
    },
    moodleAPIUrl() {
      return this.$store.getters["settings/getValue"]("rpc.moodleAPI.apiUrl");
    },
    showMoodleAPIUrl() {
      return this.$store.getters["settings/getValue"]("rpc.moodleAPI.showInput.apiUrl") === "true";
    },
    moodleOptionsFields() {
      if (this.withAssignmentId) {
        return [
          ...this.basicMoodleOptionsFields,
          {
            key: "assignmentID",
            label: "Assignment ID:",
            type: "text",
            required: true,
            placeholder: "assignment-id-placeholder",
          },
        ];
      } else {
        return this.basicMoodleOptionsFields;
      }
    },
    basicMoodleOptionsFields() {
      const optionFields = [];
      if (this.showMoodleCourseId) {
        optionFields.push({
          key: "courseID",
          label: "Course ID:",
          type: "text",
          required: true,
          default: this.moodleCourseId,
          placeholder: "course-id-placeholder",
        });
      }

      if (this.showMoodleAPIKey) {
        optionFields.push({
          key: "apiKey",
          label: "Moodle API Key:",
          type: "text",
          required: true,
          default: this.moodleAPIKey,
          placeholder: "api-key-placeholder",
        });
      }

      if (this.showMoodleAPIUrl) {
        optionFields.push({
          key: "apiUrl",
          label: "Moodle URL:",
          type: "text",
          required: true,
          default: this.moodleAPIUrl,
          placeholder: "https://example.moodle.com",
        });
      }

      return optionFields;
    },
  },
  watch: {
    moodleOptions: {
      handler() {
        this.$emit("update:modelValue", this.moodleOptions);
      },
      deep: true,
    },
  },
  mounted() {
    this.moodleOptions = this.modelValue;
  },
  methods: {
    reset() {
      this.moodleOptions = {};
    },
    validate() {
      return this.$refs.form.validate();
    },
  },
});
</script>

<style scoped></style>
