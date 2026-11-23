<template>
        <div class="d-flex justify-content-between align-items-center p-1 card-header">
          <span class="text-start">
            <!-- Always visible: inspect and copy -->
            <BasicButton
              class="btn border-0"
              icon="info-circle"
              :tooltip="$t('basic.graph.inspectNode')"
              :disabled="!activateEditNode"
              @click="act('inspect')"
            />
            <BasicButton
              class="btn border-0"
              icon="copy"
              :tooltip="$t('basic.graph.copyNode')"
              :disabled="!activateEditNode"
              @click="act('copy')"
            />
            <!-- Edit mode buttons -->
            <template v-if="editable">
              <BasicButton
                class="btn border-0"
                :rotate-icon="180"
                icon="node-plus"
                :tooltip="$t('basic.graph.addNodeBefore')"
                :disabled="!activateAddNode"
                @click="act('add-before')"
              />
              <BasicButton
                class="btn border-0"
                :disabled="!activateAddNode"
                icon="node-plus"
                :tooltip="$t('basic.graph.addNodeAfter')"
                @click="act('add-after')"
              />
              <BasicButton
                class="btn border-0"
                icon="dash-circle"
                :tooltip="$t('basic.graph.removeNode')"
                :disabled="!activateRemoveNode"
                @click="act('remove')"
              />
              <BasicButton
                class="btn border-0"
                icon="pencil"
                :tooltip="$t('basic.graph.editNode')"
                :disabled="!activateEditNode"
                @click="act('edit')"
              />
              <div v-if="activatePasteNode" class="position-relative d-inline-block">
                <BasicButton
                  class="btn border-0"
                  :disabled="!activatePasteNode"
                  icon="clipboard"
                  :tooltip="$t('basic.graph.pasteCopiedNode')"
                  @click="showPasteOptions = !showPasteOptions"
                />
                <!-- Paste Options Modal -->
                <div v-if="showPasteOptions" class="paste-options-modal">
                  <BasicButton
                    class="btn border-0"
                    :rotate-icon="180"
                    icon="node-plus"
                    :tooltip="$t('basic.graph.pasteBeforeSelectedNode')"
                    @click="act('paste-before')"
                  />
                  <BasicButton
                    class="btn border-0"
                    icon="node-plus"
                    :tooltip="$t('basic.graph.pasteAfterSelectedNode')"
                    @click="act('paste-after')"
                  />
                </div>
              </div>
            </template>
            <!-- Readonly indicator -->
            <span v-else class="badge text-bg-secondary ms-1 align-middle d-inline-flex align-items-center gap-1">
              <BasicIcon icon-name="lock-fill" :size="12" color="#fff" />
              {{ $t("basic.graph.readOnly") }}
            </span>
          </span>
        </div>
</template>
<script>
import BasicButton from '@/basic/Button.vue';
import BasicIcon from '@/basic/Icon.vue';
export default {
  name:'GraphToolbar', components:{BasicButton,BasicIcon},
  props: {editable:{type:Boolean,default:true}, selectedNodes:{type:Array,required:true},
  activateEditNode:{type:Boolean,default:false}, activateAddNode:{type:Boolean,default:false},
  activateRemoveNode:{type:Boolean,default:false}, activatePasteNode:{type:Boolean,default:false}},
  emits:["inspect","copy","add-before","add-after","remove","edit","paste-before","paste-after"],
  data(){return {showPasteOptions:false};},
  watch:{selectedNodes(){this.showPasteOptions=false;}},
  methods:{act(event){if(event.startsWith('paste-'))this.showPasteOptions=false;this.$emit(event);}},
};
</script>
<style scoped>
.paste-options-modal {
  position: absolute;
  top: 100%;
  left: -75%;
  background: var(--bs-body-bg, white);
  border: 1px solid var(--bs-border-color, #dee2e6);
  border-radius: 0.375rem;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
  padding: 0.5rem;
  z-index: 1000;
  display: flex;
  gap: 0.25rem;
  margin-top: 0.25rem;
}
</style>
