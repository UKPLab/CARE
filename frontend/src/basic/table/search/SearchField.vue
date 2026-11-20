<template>
<div
      :ref="el => controller.setSearchRef('tokenField',el)"
      :style="{'--token-menu-left': `${controller.menuLeft}px`}"
      class="form-control token-field d-flex flex-wrap align-items-center"
      @click="onFieldClick"
    >
      <TokenChips :ref="el => controller.setSearchRef('TokenChips',el)" />

      <PendingFilter :ref="el => controller.setSearchRef('PendingFilter',el)" />
      <DraftInput :ref="el => controller.setSearchRef('DraftInput',el)" />
      <SuggestionsMenu :ref="el => controller.setSearchRef('SuggestionsMenu',el)" />

    </div>
</template>
<script>
import TokenChips from "./TokenChips.vue";
import PendingFilter from "./PendingFilter.vue";
import DraftInput from "./DraftInput.vue";
import SuggestionsMenu from "./SuggestionsMenu.vue";


export default {
name:"TableSearchSearchField",
components:{TokenChips,PendingFilter,DraftInput,SuggestionsMenu},
inject:{controller:{from:"tableSearchController"}},
methods:{
onFieldClick(event) {
      if (event.target.closest(".token-input, .token-raw, .token-chip, .token-gap, .token-suggestions")) {
        return;
      }
      this.controller.focusDraft("end");
    },
focusGap(index) {
      this.controller.movingFocus = true;
      this.controller.closeSuggestions();
      this.controller.$nextTick(() => {
        const el = index < 0 ? this.controller.searchRefs.leadingGap : this.controller.gapEls[index];
        if (el && (index < 0 || index < this.controller.tokens.length)) {
          el.focus();
          this.controller.movingFocus = false;
          return;
        }
        this.controller.focusDraft("start");
      });
    },
onGapKeydown(index, event) {
      if (event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.controller.expandToken(index, "end");
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        const next = index + 1;
        if (next < this.controller.tokens.length) {
          this.controller.expandToken(next, "start");
        } else {
          this.controller.focusDraft("start");
        }
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        this.controller.removeFromGap(index);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        this.controller.focusDraft("end");
        return;
      }
      this.controller.typeFromGap(event);
    },
removeFromGap(index) {
      this.controller.movingFocus = true;
      this.controller.removeTokenAt(index);
      if (this.controller.tokens.length === 0) {
        this.controller.focusDraft("start");
        return;
      }
      if (index === 0) {
        this.controller.focusGap(-1);
        return;
      }
      this.controller.focusGap(index - 1);
    },
onLeadingGapKeydown(event) {
      if (event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        this.controller.expandToken(0, "start");
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        this.controller.focusDraft("end");
        return;
      }
      this.controller.typeFromGap(event);
    },
typeFromGap(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.length !== 1) return;
      event.preventDefault();
      const ch = event.key;
      this.controller.draft = `${ch}${this.controller.draft}`;
      this.controller.movingFocus = true;
      this.controller.$nextTick(() => {
        const el = this.controller.searchRefs.input;
        if (el) {
          el.focus();
          el.setSelectionRange(ch.length, ch.length);
        }
        this.controller.movingFocus = false;
        this.controller.suggestionsOpen = true;
      });
    },
onGapPaste(event) {
      const text = event.clipboardData?.getData("text") || "";
      if (!text) return;
      this.controller.draft = this.controller.draft ? `${text} ${this.controller.draft}` : text;
      this.controller.movingFocus = true;
      this.controller.$nextTick(() => {
        const el = this.controller.searchRefs.input;
        if (el) {
          el.focus();
          el.setSelectionRange(text.length, text.length);
        }
        this.controller.movingFocus = false;
        this.controller.absorbTokens();
        this.controller.suggestionsOpen = true;
        this.controller.emitUpdate();
      });
    }
}
};
</script>

<style scoped>
.token-field {
  --token-chip-gap: 0.2rem;
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  height: auto;
  min-height: calc(1.5em + 0.5rem + 2px);
  cursor: text;
  column-gap: 0;
  row-gap: 0.25rem;
  overflow: visible;
}
</style>
