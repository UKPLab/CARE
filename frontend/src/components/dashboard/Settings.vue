<template>
  <div>
    <h1>Settings</h1>
    <div class="button-group">
      <button
        class="btn btn-primary me-2"
        @click="save"
      >
        <LoadIcon
          class="me-1"
          iconName="upload"
        ></LoadIcon>
        Save Settings
      </button>
      <button
        class="btn btn-primary"
        @click="load"
      >
        <LoadIcon
          class="me-1"
          iconName="download"
        ></LoadIcon>
        Load Settings
      </button>
    </div>
  </div>
  <Loading v-if="settings === null"></Loading>
  <div v-else>
    <div
      v-for="k1 in firstKeys"
      :key="k1"
      class="card my-3"
    >
      <div>
        <div
          class="card-header"
          style="cursor: pointer"
          @click="collapseFirst[k1] = !collapseFirst[k1]"
        >
          <LoadIcon
            :icon-name="collapseFirst[k1] ? 'arrow-right-short' : 'arrow-down-short'"
            class="me-1"
          ></LoadIcon>
          <!-- Main title inside card header -->
          {{ k1 }}
          <br />
          <span
            v-if="k1 === 'app'"
            class="text-secondary"
            ><small>Main settings of the application <br />Note: Make sure that no sensitive data are present!</small></span
          >
        </div>
        <div
          v-if="!collapseFirst[k1]"
          class="card-body"
        >
          <div
            v-for="k2 in secondKeys.filter((e) => e.firstKey === k1)[0].secondKeys"
            :key="k2"
            class="mb-3"
          >
            <!-- Subtitle inside card body -->
            <div>
              {{ k2 }}
            </div>
            <div
              v-for="s in settings.filter((setting) => setting['key'].startsWith(k1 + '.' + k2))"
              :key="s"
              class="row"
            >
              <div class="col-12">
                <div class="card mt-3">
                  <div class="card-body">
                    <h5 class="card-title">{{ s.key }}</h5>
                    <h6 class="card-subtitle mb-2 text-muted">
                      {{ s.description }}
                    </h6>
                    <div class="card-text">
                      <div v-if="s.type === 'html'">
                        <EditorModal
                          v-model="s.value"
                          :title="'Edit ' + s.key"
                        ></EditorModal>
                      </div>
                      <div
                        v-else-if="s.type === 'boolean' || s.type === 'bool'"
                        class="form-check form-switch"
                      >
                        <input
                          ref="nlpSwitch"
                          v-model="s.value"
                          :checked="s.value"
                          class="form-check-input"
                          role="switch"
                          title="Activate/Deactivate NLP support"
                          type="checkbox"
                        />
                      </div>
                      <input
                        v-else
                        v-model="s.value"
                        class="w-50"
                        type="text"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Loading from "@/basic/Loading.vue";
import LoadIcon from "@/basic/Icon.vue";
import EditorModal from "@/basic/editor/Modal.vue";

/**
 * Dashboard component for handling settings by admins
 *
 * @author: Dennis Zyska
 */
export default {
  name: "DashboardSettings",
  components: { EditorModal, LoadIcon, Loading },
  data: function () {
    return {
      settings: null,
      editorSetting: null,
      editorTitle: "",
      editorContent: "",
      collapseFirst: {},
    };
  },
  computed: {
    firstKeys() {
      if (this.settings) {
        return this.settings.map((s) => s.key.split(".")[0]).filter((v, i, a) => a.indexOf(v) === i);
      }
      return [];
    },
    secondKeys() {
      if (this.firstKeys.length > 0) {
        return this.firstKeys.map((key) => {
          return {
            firstKey: key,
            secondKeys: this.settings
              .filter((setting) => setting["key"].startsWith(key))
              .map((s) => s.key.split(".")[1])
              .filter((v, i, a) => a.indexOf(v) === i),
          };
        });
      }
      return [];
    },
  },
  sockets: {
    settingData: function (data) {
      this.settings = data.sort((a, b) => (a.key > b.key ? 1 : b.key > a.key ? -1 : 0));
      this.collapseFirst = this.firstKeys.reduce((acc, curr) => ((acc[curr] = true), acc), {});
    },
  },
  mounted() {
    this.settings = null;
    this.$socket.emit("settingGetData");
  },
  methods: {
    save() {
      this.$socket.emit("settingSave", this.settings);
    },
  },
};
</script>

<style scoped></style>
