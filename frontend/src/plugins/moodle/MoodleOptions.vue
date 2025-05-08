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
import deepEqual from "deep-equal";

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
      assignments: [],
    };
  },
  computed: {
    moodleCourseId() {
      return this.$store.getters["settings/getValue"]("rpc.moodleAPI.courseID");
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
        const assignmentField = {
          key: "assignmentID",
          label: "Assignment ID:",
          required: true,
          suffix: {
            text: "Refresh",
            onClick: this.fetchAssignments,
            tooltip: "Refresh assignments list",
          },
        };

        if (this.assignments.length > 0) {
          assignmentField.type = "select";
          assignmentField.options = this.assignments.map(([id,title]) => ({
            value: id,
            name: title,
          }));
          assignmentField.icon = "list";
        } else {
          assignmentField.type = "text";
          // NOTE: This text field should be given a default value, so the parent component can have access to this field.
          // Please refer to commit#2c717d2.
          assignmentField.default = "";
          assignmentField.placeholder = "assignment-id-placeholder";
        }

        return [...this.basicMoodleOptionsFields, assignmentField];
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

        if (this.moodleOptions.assignmentID && typeof this.moodleOptions.assignmentID === 'object') {
          this.moodleOptions.assignmentID = this.moodleOptions.assignmentID.value; 
        }
        if (typeof this.moodleOptions.assignmentID === 'string') {
          this.moodleOptions.assignmentID = Number(this.moodleOptions.assignmentID); // make sure it’s a number
        }

        if (!deepEqual(this.moodleOptions, this.modelValue)) {
          this.$emit("update:modelValue", this.moodleOptions);
        }
        if (this.withAssignmentId) {
          if (!this.moodleOptions.courseID || !this.moodleOptions.apiKey || !this.moodleOptions.apiUrl) {
            this.assignments = [];
            return;
          }
        }
      },
      deep: true,
    },
    modelValue: {
      handler() {
        this.moodleOptions = this.modelValue;
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
    fetchAssignments() {
      this.$socket.emit(
        "assignmentGetInfo",
        {
          options: {
            courseID: this.moodleOptions.courseID,
            apiKey: this.moodleOptions.apiKey,
            apiUrl: this.moodleOptions.apiUrl,
          },
        },
        (res) => {
          this.assignments = res.success ? res["data"] : [];
        }
      );
    },
  },
});
</script>

<style scoped></style>
