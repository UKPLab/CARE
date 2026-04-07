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
                      <div class="card-text">
                        <div v-if="setting.type === 'edits'">
                          <EditorModal v-model="setting.value" :title="'Edit ' + setting.key"></EditorModal>
                        </div>
                        <div v-else-if="setting.type === 'boolean' || setting.type === 'bool'" class="form-check form-switch">
                          <input 
                            v-model="setting.value" 
                            :checked="setting.value"
                            class="form-check-input" 
                            role="switch" 
                            title="Activate/Deactivate NLP support"
                            type="checkbox"
                          >
                        </div>
                        <textarea
                            v-else-if="setting.type === 'text'"
                            v-model="setting.value"
                            class="w-100 form-control"
                            rows="6"
                        ></textarea>
                        <div v-else-if="isEmailTemplateSetting(setting)" class="w-50">
                          <select v-model="setting.value" class="form-select">
                            <option value="">None (use default email)</option>
                            <option 
                              v-for="template in getFilteredEmailTemplates(setting)" 
                              :key="template.id" 
                              :value="String(template.id)"
                            >
                              {{ template.name }} (ID: {{ template.id }})
                            </option>
                          </select>
                        </div>
                        <input v-else v-model="setting.value" class="w-50" type="text">
                      </div>
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
  subscribeTable: ["template"],
  props: {
    group: Object,
    title: String
  },
  data() {
    return {
      collapsed: true
    };
  },
  computed: {
    user() {
      return this.$store.getters["auth/getUser"];
    },
    emailTemplates() {
      const allTemplates = this.$store.getters["table/template/getAll"]
        .filter(t => !t.deleted && (t.type === 1 || t.type === 2 || t.type === 3 || t.type === 6));
      
      // Show only the user's own templates (includes copies since copies have userId === currentUser)
      const visibleTemplates = allTemplates.filter(t => t.userId === this.user?.id);
      
      return visibleTemplates.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type
      }));
    }
  },
  methods: {
    toggleCollapse() {
      this.collapsed = !this.collapsed;
    },
    isEmailTemplateSetting(setting) {
      return setting.key && 
             setting.key.startsWith("email.template.") && 
             (setting.type === "number" || setting.type === "integer");
    },
    getFilteredEmailTemplates(setting) {
      // Determine template type based on setting key
      let requiredType = null;
      if (setting.key === "email.template.passwordReset" || 
          setting.key === "email.template.verification" || 
          setting.key === "email.template.registration" ||
          setting.key === "email.template.twoFactorOtp" ||
          setting.key === "email.template.passwordResetSuccess") {
        requiredType = 1; // Email - General
      } else if (setting.key === "email.template.sessionStart" || 
                 setting.key === "email.template.sessionFinish") {
        requiredType = 2; // Email - Study Session
      } else if (setting.key === "email.template.assignment") {
        requiredType = 3; // Email - Assignment
      } else if (setting.key === "email.template.studyClosed") {
        requiredType = 6; // Email - Study Close
      }
      
      // Filter by type if determined
      return requiredType !== null 
        ? this.emailTemplates.filter(t => t.type === requiredType)
        : this.emailTemplates;
    }
  }
};
</script>

<style scoped>
/* Add your styles here if needed */
</style>
