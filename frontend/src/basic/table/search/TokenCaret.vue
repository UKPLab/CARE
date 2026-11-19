<template>
<span :ref="el => index < 0 ? controller.setSearchRef('leadingGap',el) : controller.bindGapRef(index,el)" :class="['token-gap', {'token-gap-leading':index < 0}]" :aria-label="index < 0 ? 'before-filters' : 'between-filters'" tabindex="0" @click.stop @keydown="index < 0 ? controller.onLeadingGapKeydown($event) : controller.onGapKeydown(index,$event)" @paste.prevent="controller.onGapPaste" />
</template>
<script>



export default {
name:"TableSearchTokenCaret",
components:{},
inject:{controller:{from:"tableSearchController"}},
props:{index:{type:Number,required:true}},
};
</script>

<style scoped>
.token-gap {
  display: inline-block;
  flex: 0 0 0;
  width: 0;
  overflow: visible;
  align-self: stretch;
  position: relative;
  outline: none;
  cursor: text;
}
.token-gap:focus {
  outline: none;
}
.token-gap:focus::before {
  content: "";
  position: absolute;
  left: calc(var(--token-chip-gap) / -2);
  top: 0.2em;
  width: 1px;
  height: 1em;
  background: currentColor;
  animation: token-caret 1s step-end infinite;
}
@keyframes token-caret {
  50% { opacity: 0; }
}
</style>
