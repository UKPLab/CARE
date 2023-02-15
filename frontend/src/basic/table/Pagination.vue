<template>
  <!-- Pagination -->
  <nav v-if="pages > 1" aria-label="Pagination">

    <ul class="pagination justify-content-end">
      <li :class="{'disabled':(currentPage ===1)}" class="page-item">
        <button class="page-link" @click="changePage(currentPage - 1)">
          <span aria-hidden="true">&laquo;</span>
        </button>
      </li>
      <li v-for="p in pages"
          :class="{'active': p === currentPage, 'disabled': (p === currentPage - 3 || p === currentPage + 3)}"
          class="page-item">

        <button v-if="p === currentPage - 3" class="page-link">...</button>
        <button v-if="p < currentPage + 3 && p > currentPage - 3" class="page-link" @click="changePage(p)">
          {{ p }}
        </button>
        <button v-if="p === currentPage + 3" class="page-link">...</button>

      </li>
      <li :class="{'disabled':(currentPage === pages)}" class="page-item">
        <button class="page-link" @click="changePage(currentPage + 1)">
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
      page: 1
    }
  },
  emits: ["pageChange"],
  props: {
    pages: {
      type: Number,
      required: true
    },
    currentPage: {
      type: Number,
      required: true
    },
  },
  methods: {
    changePage(newVal) {
      this.$emit("pageChange", newVal);
    }
  }
}
</script>

<style scoped>

</style>