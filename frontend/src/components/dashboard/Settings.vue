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
    <div v-for="k in firstKey" class="card my-3">
      <div class="card-header">
        {{ k }}
        <br>
        <span v-if="k === 'app'" class="text-secondary"><small>Main settings of the application <br>Note: Make sure that no sensitive data are present!</small></span>
      </div>
      <div class="card-body">
        <div v-for="s in settings.filter(setting => setting['key'].startsWith(k))" class="row">

          <div class="col-12">
            <div class="card mt-3">
              <div class="card-body">
                <h5 class="card-title">{{ s.key }}</h5>
                <h6 class="card-subtitle mb-2 text-muted">{{ s.description }}</h6>
                <p class="card-text"><input v-model="s.value" type="text">

                  <LoadIcon v-if="s.type === 'html'" class="mx-2" iconName="border-style"
                            v-on:click="openEditor(s)"></LoadIcon>
                </p>
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
import Loading from "../basic/Loading.vue";
import LoadIcon from "../../icons/LoadIcon.vue";
import Modal from "../basic/Modal.vue";
import EditorModal from "../basic/EditorModal.vue";

export default {
  name: "Settings",
  components: {EditorModal, LoadIcon, Loading, Modal},
  data: function () {
    return {
      settings: null,
      editorSetting: null,
      editorTitle: "",
      editorContent: "",
    }
  },
  computed: {
    firstKey() {
      if (this.settings) {
        return this.settings.map(s => s.key.split(".")[0]).filter((v, i, a) => a.indexOf(v) === i);
      }
      return [];
    }
  },
  sockets: {
    settingData: function (data) {
      this.settings = data.sort((a, b) => (a.key > b.key) ? 1 : ((b.key > a.key) ? -1 : 0))
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