<template>
<span class="token-compose">
        <input
          :ref="el => controller.setSearchRef('input',el)"
          v-model="draftValue"
          :placeholder="inputPlaceholder"
          aria-describedby="search-addon1"
          aria-label="table-search"
          class="token-input"
          type="text"
          @focus="onFocus"
          @blur="onDraftBlur"
          @click.stop
          @keydown.down.prevent="controller.moveHighlight(1)"
          @keydown.up.prevent="controller.moveHighlight(-1)"
          @keydown.enter.prevent="onEnter"
          @keydown.left="onDraftLeft"
          @keydown.right="onDraftRight"
          @keydown.delete="onBackspace"
          @paste="onPaste"
        />
      </span>
</template>
<script>

import { coerceValue, defaultOperator, needsTypedValue, parseQuery, unquote } from "../searchTokens.js";

export default {
name:"TableSearchDraftInput",
components:{},
inject:{controller:{from:"tableSearchController"}},
computed:{
inputPlaceholder() {
      // A picked operator on a typed-value key (Sessions ≥ …) is not a filter until a value arrives.
      if (this.controller.stage === "value" && this.controller.pending.key) {
        const operator = this.controller.pending.operator || defaultOperator(this.controller.schema, this.controller.pending.key);
        let listHint = "";
        if (operator === "=") listHint = this.controller.$t("common.typeExactListHint");
        else if (operator === "!=") listHint = this.controller.$t("common.typeNoneOfHint");
        else if (operator === "~") listHint = this.controller.$t("common.typeContainsListHint");
        else if (operator === "%") listHint = this.controller.$t("common.typeContainsAnyListHint");
        if (needsTypedValue(this.controller.schema, this.controller.pending.key)) {
          const type = this.controller.schema[this.controller.pending.key].type;
          let hint = this.controller.$t("common.typeValueHint");
          if (type === "numeric") hint = this.controller.$t("common.typeNumberHint");
          else if (type === "date") hint = this.controller.$t("common.typeDateHint");
          if (type === "date" || !listHint) return hint;
          return `${hint}. ${listHint}`;
        }
      }
      if (this.controller.tokens.length > 0 || this.controller.pending.key) return "";
      return this.controller.hasSchema ? this.controller.$t("common.searchOrFilter") : (this.controller.placeholder || this.controller.$t("common.typeToFilter"));
    }, draftValue:{get(){return this.controller.draft;},set(value){this.controller.setDraft(value);}}},
watch:{"controller.draft": function() {
      if (this.controller.tryResolvePendingOperator()) return;
      // A typed value becomes a chip on Enter
      this.controller.tryPromoteDraftKey();
      this.controller.highlight = -1;
      this.controller.hoverIndex = -1;
      this.controller.emitUpdate();
    }},
methods:{
focusDraft(caret = "end") {
      this.controller.$nextTick(() => {
        const el = this.controller.searchRefs.input;
        if (el) {
          el.focus();
          const position = caret === "start" ? 0 : el.value.length;
          el.setSelectionRange(position, position);
        }
        this.controller.movingFocus = false;
      });
    },
onFocus() {
      if (!this.controller.pending.key) this.controller.stage = "key";
      this.controller.suggestionsOpen = true;
      this.controller.syncMenuPosition();
    },
onDraftBlur() {
      if (this.controller.movingFocus) return;
      if (this.controller.showDatePicker) return;
      this.controller.closeSuggestions();
    },
onEnter() {
      const index = this.controller.highlight >= 0 ? this.controller.highlight : this.controller.hoverIndex;
      const suggestion = index >= 0 ? this.controller.suggestions[index] : null;
      if (this.controller.suggestionsOpen && suggestion) {
        this.controller.pickSuggestion(suggestion);
        return;
      }
      this.commitDraft();
    },
commitDraft() {
      if (this.controller.pending.key && this.controller.stage === "operator") {
        this.controller.tryResolvePendingOperator(true);
        return;
      }
      if (this.controller.pending.key) {
        const value = coerceValue(
          this.controller.schema,
          this.controller.pending.key,
          unquote(this.controller.draft.trim()),
          this.controller.$t.bind(this.controller),
          this.controller.pending.operator || defaultOperator(this.controller.schema, this.controller.pending.key),
        );
        if (value !== null) {
          this.commitPending(value);
          return;
        }
        if (this.controller.draft.trim()) {
          this.controller.abandonPendingToDraft();
          return;
        }
        // Operator picked but no usable value yet — keep waiting instead of dropping the filter.
        if (needsTypedValue(this.controller.schema, this.controller.pending.key) && this.controller.stage === "value") {
          return;
        }
      }
      this.absorbTokens();
      this.controller.emitUpdate();
      this.controller.searchRefs.input?.blur();
    },
commitPending(value) {
      this.controller.addToken({
        key: this.controller.pending.key,
        operator: this.controller.pending.operator || defaultOperator(this.controller.schema, this.controller.pending.key),
        value,
      });
      // Clear the typed value while pending is still set so it never lands in `search`.
      this.controller.draft = "";
      this.controller.resetPending();
    },
onBackspace() {
      if (this.controller.draft !== "") return;
      // Outside a raw zone there is nothing to edit character by character — drop the whole filter.
      if (this.controller.pending.key) {
        this.controller.resetPending();
      } else if (this.controller.tokens.length > 0) {
        this.controller.removeTokenAt(this.controller.tokens.length - 1);
      }
    },
onDraftLeft(event) {
      const el = event.target;
      if (el.selectionStart !== 0 || el.selectionEnd !== 0) return;
      if (this.controller.pending.key) {
        event.preventDefault();
        this.controller.collapsePendingToDraft();
        return;
      }
      if (this.controller.tokens.length === 0) return;
      event.preventDefault();
      this.controller.focusGap(this.controller.tokens.length - 1);
    },
onDraftRight(event) {
      if (this.controller.pending.key) return;
      const el = event.target;
      if (el.selectionStart !== el.selectionEnd) return;
      const first = (this.controller.draft.trimStart().match(/^\S+/) || [])[0];
      if (!first) return;
      const wordEnd = this.controller.draft.length - this.controller.draft.trimStart().length + first.length;
      const pos = el.selectionStart;
      // Revive on the Right that reaches the end of a recognized key, not one press later.
      if (pos < wordEnd - 1 || pos > wordEnd) return;
      if (!this.controller.revivePendingFromDraft()) return;
      event.preventDefault();
    },
onPaste() {
      this.controller.$nextTick(() => {
        this.absorbTokens();
        this.controller.emitUpdate();
      });
    },
absorbTokens() {
      const {tokens, text} = parseQuery(this.controller.schema, this.controller.draft, this.controller.$t.bind(this.controller));
      if (tokens.length === 0) return;
      tokens.forEach((token) => this.controller.addToken(token));
      this.controller.draft = text.length > 0 ? `${text.join(" ")} ` : "";
    }
}
};
</script>

<style scoped>
.token-compose {
  flex: 1 1 8rem;
  min-width: 8rem;
  display: flex;
  align-items: center;
  align-self: stretch;
}
.token-input {
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
  border: 0;
  padding: 0;
  background: transparent;
  outline: none;
}
</style>
