<template>
  <form>
    <div class="row g-3">
      <div v-for="field in fields" :key="field.name" :class="('size' in field)?'col-md-' + field.size :'col-12'">
        <span v-if="field.type === 'switch'"
             class="form-check form-switch">
          <input class="form-check-input" type="checkbox">
          <label :for="field.name" class="form-label">{{ field.label }}</label>
           <button v-if="'help' in field" :title="field.help" class="btn btn-sm mt-0 pt-0" data-bs-html="true"
                   data-bs-placement="top"
                   data-bs-toggle="tooltip">
              <LoadIcon :size="16" iconName="question-square-fill"></LoadIcon>
           </button>
        </span>
        <span v-else>
            <label v-if="'label' in field" :for="field.name" class="form-label" >{{ field.label }}</label>
          <button v-if="'help' in field" :title="field.help" class="btn btn-sm mt-0 pt-0" data-bs-html="true"
                  data-bs-placement="top"
                  data-bs-toggle="tooltip">
              <LoadIcon :size="16" iconName="question-square-fill"></LoadIcon>
           </button>


          <input v-if="field.type === 'checkbox'" :id="field.name" v-model="data[field.name]" :name="field.name"
                 :required="field.required" :type="field.type" class="form-check-input"/>
            <textarea v-else-if="field.type === 'textarea'" :id="field.name" v-model="data[field.name]"
                      :name="field.name"
                      :required="field.required" :type="field.type" class="form-control"/>

          <input v-else
                 :id="field.name"
                 :class="field.class"
                 :name="field.name"
                 :required="field.required"
                 :type="field.type"
                 :value="data[field.name]"
                 class="form-control"
          >
        </span>


      </div>
    </div>
  </form>
</template>

<script>
import LoadIcon from "@/icons/LoadIcon.vue";

export default {
  name: "Form",
  components: {LoadIcon},
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