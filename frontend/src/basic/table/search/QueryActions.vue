<template>
    <button
      v-if="controller.hasBarQuery"
      :title="controller.copied ? $t('common.queryCopied') : $t('common.copySearchQuery')"
      class="btn btn-outline-secondary search-bar-btn"
      type="button"
      @click="copyQuery"
    >
      <LoadIcon :icon-name="controller.copied ? 'check' : 'clipboard'" />
    </button>
    <button
      v-if="controller.hasBarQuery"
      class="btn btn-outline-secondary search-bar-btn"
      :title="$t('common.clearSearch')"
      type="button"
      @click="clearAll"
    >
      <LoadIcon icon-name="x-lg" />
    </button>

</template>
<script>


import LoadIcon from "@/basic/Icon.vue";

export default {
name:"TableSearchQueryActions",
components:{LoadIcon},
inject:{controller:{from:"tableSearchController"}},
methods:{
clearAll() {
      this.controller.tokens = [];
      this.controller.editIndex = null;
      this.controller.editText = "";
      this.controller.resetPending();
      this.controller.draft = "";
      this.controller.closeSuggestions();
      this.controller.emitUpdate();
    },
async copyQuery() {
      const text = this.controller.queryString;
      if (!text) return;
      let ok;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch (_error) {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      }
      this.controller.copied = ok;
      clearTimeout(this.controller.copiedTimer);
      if (ok) {
        this.controller.copiedTimer = setTimeout(() => {
          this.controller.copied = false;
        }, 2000);
      }
    }
}
};
</script>

<style scoped>
/* Direct children of the input group next to the token field. */
.search-bar-btn {
  flex-shrink: 0;
}
</style>
