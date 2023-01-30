<template>
  <!-- Pagination -->
  <nav v-if="pages > 1" aria-label="Pagination">

    <ul class="pagination justify-content-end">
      <li :class="{'disabled':(currentPage ===1)}" class="page-item">
        <button class="page-link" @click="currentPage -= 1">
          <span aria-hidden="true">&laquo;</span>
        </button>
      </li>
      <li v-for="p in pages"
          :class="{'active': p === currentPage, 'disabled': (p === currentPage - 3 || p === currentPage + 3)}"
          class="page-item">

        <button v-if="p === currentPage - 3" class="page-link">...</button>
        <button v-if="p < currentPage + 3 && p > currentPage - 3" class="page-link" @click="currentPage = p">
          {{ p }}
        </button>
        <button v-if="p === currentPage + 3" class="page-link">...</button>

      </li>
      <li :class="{'disabled':(currentPage === pages)}" class="page-item">
        <button class="page-link" @click="currentPage += 1">
          <span aria-hidden="true">&raquo;</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<script>
export default {
  name: "Pagination.vue",
  data() {
    return {
      currentPage: null
    }
  },
  emits: ["pageChange"],
  props: {
    pages: {
      type: Number,
      required: true
    },
    startPage: {
      type: Number,
      required: true
    },
  },
  mounted() {
    this.currentPage = this.startPage;
  },
  watch:{
    currentPage(newVal){
      this.$emit("pageChange", newVal);
    }
  }
}
</script>

<style scoped>

</style>