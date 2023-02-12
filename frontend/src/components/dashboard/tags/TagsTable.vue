<template>
  <table class="table table-hover">
    <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Color</th>
      <th scope="col">Description</th>
      <th scope="col">Actions</th>
    </tr>
    </thead>
    <tbody>
    <tr v-for="t in tags">
      <td><input id="basic-url" v-model="t.name" aria-describedby="basic-addon3" class="form-control" type="text"></td>
      <td><select v-model="t.colorCode" :class="'border-2 border-' + t.colorCode" aria-label="Default select example"
                  class="form-select">
        <option class="text-info">info</option>
        <option class="border border-warning">warning</option>
        <option>success</option>
        <option>danger</option>
      </select></td>
      <td><input id="exampleFormControlInput1" v-model="t.description" class="form-control"
                 placeholder="Add description"
                 type="email"></td>
      <td>
        <button class="btn btn-outline-primary" type="button" @click="t.deleted = true">
          <svg class="bi bi-trash3" fill="currentColor" height="16" viewBox="0 0 16 16" width="16"
               xmlns="http://www.w3.org/2000/svg">
            <path
                d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1h-.995a.59.59 0 0 0-.01 0H11Zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5h9.916Zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47ZM8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5Z"/>
          </svg>
        </button>
      </td>
    </tr>
    <tr>
      <td colspan="4" style="text-align-last: end">
        <button class="btn btn-primary" type="button" @click="addTag(tagSetId)">Add Tag</button>
      </td>
    </tr>
    </tbody>
  </table>
</template>

<script>
/* TagsTable.vue - table structure for handling tags in tagset

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/
import {mapMutations} from "vuex";


export default {
  name: "TagsTable",
  props: {
    tagSetId: {
      required: false,
      type: Number,
      default: null,
    }
  },
  methods: {
    ...mapMutations({addTag: "tag/ADD_EMPTY_TAG"}),
  },
  computed: {
    tags() {
      return this.$store.getters['tag/getTags'](this.tagSetId);
    },
  }
}
</script>

<style scoped>

</style>