<template>
  <form>
    <div class="form-group">
      <div v-for="field in fields" :key="field.name">
        <label :for="field.name">{{ field.label }}</label>
        <input v-if="field.type === 'text'" :id="field.name" :name="field.name" :type="field.type" class="form-control" :required="field.required" v-model="data[field.name]" />
        <input v-if="field.type === 'checkbox'" :id="field.name" :name="field.name" :type="field.type" class="form-check-input" :required="field.required" v-model="data[field.name]" />
        <textarea v-else-if="field.type === 'textarea'" :id="field.name" :name="field.name" :type="field.type" class="form-control" :required="field.required" v-model="data[field.name]" />
      </div>
    </div>
  </form>
</template>

<script>
export default {
  name: "Form",
  props: {
    data: {
      type: Object,
      required: true
    },
    fields: {
      type: Object,
      required: true
    },
  },
}
</script>

<style scoped>

</style>