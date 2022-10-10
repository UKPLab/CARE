<template>
<table class="table table-hover">
        <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Color</th>
          <th scope="col">Description</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="t in tags">
          <td>{{ t.name }}</td>
          <td>{{ t.colorCode }}</td>
          <td>{{ t.description }}</td>
        </tr>
        </tbody>
</table>
</template>

<script>
export default {
  name: "TagsTable",
  props: {
    id: {
      required: false,
      type: Number,
      default: null,
    }
  },
  computed: {
    tags() {
      return this.$store.getters['tag/getTags'](this.id);
    },
  }
}
</script>

<style scoped>

</style>