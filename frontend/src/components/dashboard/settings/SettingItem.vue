<template>
  <div>
    <div class="card my-3">
      <div>
        <div class="card-header" style="cursor: pointer" @click="toggleCollapse">
          <LoadIcon :icon-name="collapsed ? 'arrow-right-short' : 'arrow-down-short'" class="me-1"></LoadIcon>
          {{ title }}
          <br>
          <span v-if="title === 'app'" class="text-secondary">
            <small>Main settings of the application <br>Note: Make sure that no sensitive data are present!</small>
          </span>
          <span v-if="title === 'editor'" class="text-secondary">
            <small>Note: When the toolbar is disabled, all the tools will be hidden!</small>
          </span>
        </div>
        <div v-if="!collapsed" class="card-body">
          <template v-for="(value, key) in group">
            <div v-if="Array.isArray(value)" :key="`array-${key}`" class="mb-3">
              
              <div v-for="setting in value" :key="setting.key" class="row">
                <div class="col-12">
                  <div class="card mt-3">
                    <div class="card-body">
                      <h5 class="card-title">{{ setting.key }}</h5>
                      <h6 class="card-subtitle mb-2 text-muted">{{ setting.description }}</h6>
                      <p class="card-text">
                        <div v-if="setting.type === 'json'">
                          <EditorModal v-model="setting.value" :title="'Edit ' + setting.key"></EditorModal>
                        </div>
                        <div v-else-if="setting.type === 'boolean' || setting.type === 'bool'" class="form-check form-switch">
                          <input v-model="setting.value" :checked="setting.value"
                                 class="form-check-input" role="switch" title="Activate/Deactivate NLP support"
                                 type="checkbox">
                        </div>
                        <input v-else v-model="setting.value" class="w-50" type="text">
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <SettingItem v-else :key="`object-${key}`" :group="value" :title="key" />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";
import EditorModal from "@/basic/editor/Modal.vue";

export default {
  name: "SettingItem",
  components: { LoadIcon, EditorModal },
  props: {
    group: Object,
    title: String
  },
  data() {
    return {
      collapsed: true
    };
  },
  methods: {
    toggleCollapse() {
      this.collapsed = !this.collapsed;
    }
  }
};
</script>

<style scoped>
/* Add your styles here if needed */
</style>
