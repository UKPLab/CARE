<template>
<span
        v-if="controller.pending.key"
        class="badge rounded-pill token-chip token-chip-pending d-inline-flex align-items-center gap-1"
      >
        {{ pendingLabel }}
        <LoadIcon
          :size="10"
          cursor="pointer"
          icon-name="x"
          @click.stop="resetPending"
        />
      </span>
</template>
<script>

import { OPERATOR_LABELS, OPERATOR_LABEL_KEYS, keyLabel, operatorsFor, PENDING_TOKEN_PATTERN } from "../searchTokens.js";
import LoadIcon from "@/basic/Icon.vue";

export default {
name:"TableSearchPendingFilter",
components:{LoadIcon},
inject:{controller:{from:"tableSearchController"}},
computed:{
pendingLabel() {
      if (!this.controller.pending.key) return "";
      const operator = this.controller.pending.operator
        ? (OPERATOR_LABEL_KEYS[this.controller.pending.operator]
          ? this.controller.$t(OPERATOR_LABEL_KEYS[this.controller.pending.operator])
          : (OPERATOR_LABELS[this.controller.pending.operator] || this.controller.pending.operator))
        : "";
      return `${keyLabel(this.controller.schema, this.controller.pending.key)} ${operator}`.trim();
    }},
methods:{
collapsePendingToDraft() {
      this.writePendingIntoDraft("key");
    },
abandonPendingToDraft() {
      this.writePendingIntoDraft("end");
    },
writePendingIntoDraft(caret) {
      const key = this.controller.pending.key;
      const text = this.controller.pending.operator
        ? `${key}:${this.controller.pending.operator}`
        : keyLabel(this.controller.schema, key);
      const leftover = this.controller.draft.trim();
      this.controller.skipDraftPromote = true;
      this.resetPending();
      this.controller.draft = leftover ? `${text} ${leftover}` : text;
      this.controller.suggestionsOpen = true;
      this.controller.$nextTick(() => {
        this.controller.skipDraftPromote = false;
        const el = this.controller.searchRefs.input;
        if (el) {
          el.focus();
          const pos = caret === "key" ? text.length : el.value.length;
          el.setSelectionRange(pos, pos);
        }
      });
    },
tryResolvePendingOperator(commit = false) {
      if (!this.controller.pending.key || this.controller.stage !== "operator") return false;
      const typed = this.controller.draft.trim();
      if (!typed) return false;
      const ops = operatorsFor(this.controller.schema, this.controller.pending.key);
      const prefixes = ops.filter((operator) => operator.startsWith(typed));
      const uniqueExact = prefixes.length === 1 && prefixes[0] === typed;
      if (ops.includes(typed) && (commit || uniqueExact)) {
        this.controller.pending.operator = typed;
        this.controller.stage = "value";
        this.controller.draft = "";
        this.controller.highlight = -1;
        this.controller.hoverIndex = -1;
        this.controller.suggestionsOpen = true;
        return true;
      }
      if (prefixes.length > 0) return false;
      this.abandonPendingToDraft();
      return true;
    },
tryPromoteDraftKey() {
      if (this.controller.pending.key || this.controller.skipDraftPromote) return;
      const trimmed = this.controller.draft.trim();
      if (!trimmed) return;
      const first = (trimmed.match(/^\S+/) || [])[0];
      if (!first) return;
      const tokenMatch = PENDING_TOKEN_PATTERN.exec(first);
      if (tokenMatch && this.controller.schema[tokenMatch[1]]) {
        this.revivePendingFromDraft();
      }
    },
revivePendingFromDraft() {
      const trimmed = this.controller.draft.trimStart();
      if (!trimmed) return false;
      const first = (trimmed.match(/^\S+/) || [])[0];
      const tokenMatch = PENDING_TOKEN_PATTERN.exec(first);
      if (!tokenMatch || !this.controller.schema[tokenMatch[1]]) return false;
      const key = tokenMatch[1];
      const operator = tokenMatch[2];
      const ops = operatorsFor(this.controller.schema, key);
      if (!ops.includes(operator)) return false;
      this.controller.pending = {key, operator};
      this.controller.stage = "value";
      this.controller.draft = trimmed.slice(first.length).trimStart();
      this.controller.suggestionsOpen = true;
      this.controller.highlight = -1;
      this.controller.hoverIndex = -1;
      return true;
    },
resetPending() {
      this.controller.pending = {key: null, operator: null};
      this.controller.stage = "key";
      this.controller.highlight = -1;
      this.controller.hoverIndex = -1;
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
.token-chip-pending {
  border-style: dashed;
}
</style>
