<template>

  <div>
    <h1>Settings</h1>
    <div class="button-group">
      <button class="btn btn-primary me-2" @click="save">
        <LoadIcon class="me-1" iconName="upload"></LoadIcon>
        Save Settings
      </button>
      <button class="btn btn-primary" @click="load">
        <LoadIcon class="me-1" iconName="download"></LoadIcon>
        Load Settings
      </button>
    </div>


  </div>
  <Loading v-if="settings === null"></Loading>
  <div v-else>
    <div v-for="k1 in firstKeys" class="card my-3">
      <div >
        <div class="card-header" @click="collapseFirst[k1] = !collapseFirst[k1]" style="cursor: pointer">
          <LoadIcon class="me-1" :icon-name="(collapseFirst[k1]) ? 'arrow-right-short' : 'arrow-down-short'" ></LoadIcon>

          {{ k1 }}
          <br>
          <span v-if="k1 === 'app'" class="text-secondary"><small>Main settings of the application <br>Note: Make sure that no sensitive data are present!</small></span>
        </div>
        <div v-if="!(collapseFirst[k1])" class="card-body">
          <div v-for="k2 in secondKeys.filter(e => e.firstKey === k1)[0].secondKeys" class="mb-3">
            <div>
              {{ k2 }}
            </div>

            <div v-for="s in settings.filter(setting => setting['key'].startsWith(k1 + '.' + k2))" class="row">

              <div class="col-12">
                <div class="card mt-3">
                  <div class="card-body">
                    <h5 class="card-title">{{ s.key }}</h5>
                    <h6 class="card-subtitle mb-2 text-muted">{{ s.description }}</h6>
                    <p class="card-text">
                      <LoadIcon v-if="s.type === 'html'" class="mx-2" iconName="border-style"
                                v-on:click="openEditor(s)"></LoadIcon>
                    <div v-else-if="s.type === 'boolean' || s.type === 'bool'" class="form-check form-switch">
                      <input ref="nlpSwitch" v-model="s.value" :checked="s.value"
                             class="form-check-input" role="switch" title="Activate/Deactivate NLP support"
                             type="checkbox">
                    </div>

                    <input v-else v-model="s.value" class="w-50" type="text">
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <EditorModal ref="editor" :content="editorContent"
               :title="editorTitle" @save="saveEditor"></EditorModal>

</template>

<script>
import Loading from "@/basic/Loading.vue";
import LoadIcon from "@/icons/LoadIcon.vue";
import Modal from "@/basic/Modal.vue";
import EditorModal from "@/basic/editor/Modal.vue";

export default {
  name: "Settings",
  components: {EditorModal, LoadIcon, Loading, Modal},
  data: function () {
    return {
      settings: null,
      editorSetting: null,
      editorTitle: "",
      editorContent: "",
      collapseFirst: {},
    }
  },
  computed: {
    firstKeys() {
      if (this.settings) {
        return this.settings.map(s => s.key.split(".")[0]).filter((v, i, a) => a.indexOf(v) === i);
      }
      return [];
    },
    secondKeys() {
      if (this.firstKeys.length > 0) {
        return this.firstKeys.map(key => {
          return {
            "firstKey": key,
            "secondKeys": this.settings.filter(setting => setting['key'].startsWith(key)).map(s => s.key.split(".")[1]).filter((v, i, a) => a.indexOf(v) === i)
          }
        })
      }
      return [];
    }
  },
  sockets: {
    settingData: function (data) {
      this.settings = data.sort((a, b) => (a.key > b.key) ? 1 : ((b.key > a.key) ? -1 : 0))
      this.collapseFirst = this.firstKeys.reduce((acc,curr)=> (acc[curr]=true,acc),{});
      console.log(this.collapseFirst);
    }
  },
  mounted() {
    this.load();
  },
  methods: {
    save() {
      this.$socket.emit("settingSave", this.settings);
    },
    load() {
      this.settings = null;
      this.$socket.emit("settingGetData");
    },
    openEditor(setting) {
      this.editorSetting = setting;
      this.editorTitle = "Edit " + setting.key;
      this.editorContent = setting['value'];
      this.$refs.editor.open();
    },
    saveEditor(data) {
      this.editorSetting.value = data;
    }
  }
}
</script>

<style scoped>

</style>