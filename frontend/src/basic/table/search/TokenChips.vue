<template>
<TokenCaret v-if="controller.tokens.length > 0" :ref="el => controller.setSearchRef('TokenCaret',el)" :index="-1" />
<template
        v-for="(token, index) in controller.tokens"
        :key="token.uid"
      >
        <!-- Caret inside a filter: show the raw token so it can be edited in place. -->
        <TokenEditor v-if="controller.editIndex === index" :ref="el => controller.setSearchRef('TokenEditor',el)" :index="index" />
        <span
          v-else
          class="badge rounded-pill token-chip d-inline-flex align-items-center gap-1"
          @click.stop="expandToken(index, 'end')"
        >
          {{ chipLabel(token) }}
          <LoadIcon
            :size="10"
            cursor="pointer"
            icon-name="x"
            @click.stop="removeTokenAt(index)"
          />
        </span>
        <!-- Slot after this chip: caret sits here without entering the next filter. -->
        <TokenCaret :index="index" />
      </template>
</template>
<script>
import TokenEditor from "./TokenEditor.vue";
import TokenCaret from "./TokenCaret.vue";
import { parseToken, serializeToken, tokenLabel } from "../searchTokens.js";
import LoadIcon from "@/basic/Icon.vue";

export default {
name:"TableSearchTokenChips",
components:{TokenEditor,TokenCaret,LoadIcon},
inject:{controller:{from:"tableSearchController"}},
watch:{
/** Editing the raw form applies straight away, so `>=5` → `>=6` refilters while you type. */
"controller.editText": function(text) {
      if (this.controller.editIndex === null) return;
      const current = this.controller.tokens[this.controller.editIndex];
      const parsed = parseToken(this.controller.schema, text.trim(), this.controller.$t.bind(this.controller));
      if (!current || !parsed) return;
      if (current.key === parsed.key && current.operator === parsed.operator && current.value === parsed.value) {
        return;
      }
      this.controller.tokens.splice(this.controller.editIndex, 1, {...parsed, uid: current.uid});
      this.controller.emitUpdate();
    }},
methods:{
chipLabel(token) {
      return tokenLabel(this.controller.schema, token, this.controller.$t.bind(this.controller));
    },
expandToken(index, caret = "end") {
      const uid = this.controller.tokens[index]?.uid;
      if (this.controller.editIndex !== null && this.controller.editIndex !== index) {
        this.controller.movingFocus = true;
        this.controller.commitRaw(false);
      }
      const target = this.controller.tokens.findIndex((token) => token.uid === uid);
      if (target === -1) {
        this.controller.movingFocus = false;
        return;
      }
      this.controller.resetPending();
      this.controller.closeSuggestions();
      this.controller.movingFocus = true;
      this.controller.editIndex = target;
      this.controller.editText = serializeToken(this.controller.schema, this.controller.tokens[target]);
      this.controller.$nextTick(() => {
        const el = this.controller.rawInput();
        if (el) {
          el.focus();
          if (caret === "all") {
            el.select();
          } else {
            const position = caret === "start" ? 0 : el.value.length;
            el.setSelectionRange(position, position);
          }
        }
        this.controller.movingFocus = false;
      });
    },
removeTokenAt(index) {
      this.controller.tokens.splice(index, 1);
      if (this.controller.editIndex === index) {
        this.controller.editIndex = null;
        this.controller.editText = "";
      } else if (this.controller.editIndex > index) {
        this.controller.editIndex -= 1;
      }
      this.controller.emitUpdate();
    },
rawInput() {
      // Looked up, not ref'd: while the caret hops between chips the old editor unmounts after the new one mounts.
      return this.controller.searchRefs.tokenField?.querySelector("input.token-raw") || null;
    },
onRawKeydown(event, index) {
      if (event.key === "ArrowLeft") {
        this.onRawLeft(event, index);
        return;
      }
      if (event.key === "ArrowRight") {
        this.onRawRight(event, index);
      }
    },
onRawLeft(event, index) {
      const el = event.target;
      if (el.selectionStart !== 0 || el.selectionEnd !== 0) return;
      event.preventDefault();
      if (index === 0) return;
      this.controller.movingFocus = true;
      this.commitRaw(false);
      this.controller.focusGap(index - 1);
    },
onRawRight(event, index) {
      const el = event.target;
      if (el.selectionStart !== el.value.length || el.selectionEnd !== el.value.length) return;
      event.preventDefault();
      this.controller.movingFocus = true;
      const result = this.commitRaw(false);
      if (result === "plain") {
        this.controller.focusDraft("end");
        return;
      }
      if (result === "removed") {
        if (this.controller.tokens.length === 0) {
          this.controller.focusDraft("start");
          return;
        }
        if (index === 0) {
          this.controller.focusGap(-1);
          return;
        }
        this.controller.focusGap(index - 1);
        return;
      }
      this.controller.focusGap(index);
    },
onRawBlur() {
      if (this.controller.movingFocus) return;
      this.commitRaw(false);
    },
commitRaw(refocusDraft = false) {
      if (this.controller.editIndex === null) return "none";
      const index = this.controller.editIndex;
      const token = this.controller.tokens[index];
      const text = this.controller.editText.trim();
      this.controller.editIndex = null;
      this.controller.editText = "";
      if (!token) return "none";

      let result = "kept";
      if (!text) {
        this.controller.tokens.splice(index, 1);
        result = "removed";
      } else {
        const parsed = parseToken(this.controller.schema, text, this.controller.$t.bind(this.controller));
        if (parsed) {
          this.controller.tokens.splice(index, 1, {...parsed, uid: token.uid});
          this.controller.dedupeKey(index);
        } else {
          // Incomplete/invalid raw (`state:=` after deleting the value) stays as plain search
          // text — do not auto-promote back into a chip.
          this.controller.skipDraftPromote = true;
          this.controller.tokens.splice(index, 1);
          this.controller.draft = this.controller.draft ? `${text} ${this.controller.draft}` : text;
          result = "plain";
          this.controller.$nextTick(() => {
            this.controller.skipDraftPromote = false;
          });
        }
      }
      this.controller.emitUpdate();
      if (refocusDraft) {
        this.controller.movingFocus = true;
        this.controller.focusDraft("end");
      }
      return result;
    }
}
};
</script>

<style scoped>
.token-chip {
  margin-inline-end: var(--token-chip-gap);
  background-color: var(--bs-secondary-bg, #e9ecef);
  border: 1px solid var(--bs-border-color, #dee2e6);
  color: var(--bs-body-color, #212529);
  font-weight: 400;
  cursor: pointer;
}
</style>
