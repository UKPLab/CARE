<template>
  <div>
    <b-table striped :items="items" :fields="fields"></b-table>
  </div>
</template>

<script>
import {mapActions} from "vuex";

export default {
  data() {
    return {
      fields: [ "documentId", "title", "created_at"],
      items: [
        {documentId: 1, title: "Showcase", created_at: "2022-05-12"}
      ]
    }
  },
  mounted() {
    this.load()
  },
  methods: {
    ...mapActions({load: "user/load"})
  }
}
</script>

<style scoped>

</style>