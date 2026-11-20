<template>
<input
                    v-model="editValue"
          :style="{width: rawWidth}"
          aria-label="filter-token"
          class="token-raw"
          type="text"
          @blur="controller.onRawBlur"
          @keydown="controller.onRawKeydown($event, index)"
          @keydown.enter.prevent="controller.commitRaw(true)"
        />
</template>
<script>


export default {
name:"TableSearchTokenEditor",
components:{},
inject:{controller:{from:"tableSearchController"}},
props:{index:{type:Number,required:true}},
computed:{
rawWidth() {
      return `${Math.max(this.controller.editText.length, 2) + 1}ch`;
    }, editValue:{get(){return this.controller.editText;},set(value){this.controller.setEditText(value);}}},
};
</script>

<style scoped>
.token-raw {
  margin-inline-end: var(--token-chip-gap);
  min-width: 3ch;
  padding: 0 0.25rem;
  border: 1px solid var(--bs-primary, #0d6efd);
  border-radius: 0.25rem;
  background: transparent;
  font-family: var(--bs-font-monospace, monospace);
  outline: none;
}
</style>
