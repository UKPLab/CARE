<template>

  <div>
    <h1>Settings</h1>
    <div class="button-group">
      <button class="btn btn-primary me-2" @click="save">
        <LoadIcon iconName="upload" class="me-1"></LoadIcon>
        Save Settings
      </button>
      <button class="btn btn-primary" @click="load">
        <LoadIcon iconName="download" class="me-1"></LoadIcon>
        Load Settings
      </button>
    </div>


  </div>
  <Loading v-if="settings === null"></Loading>
  <div v-else>
    <div v-for="s in settings" class="row">
      <div class="col-12">
        <div class="card mt-3">
          <div class="card-body">
            <h5 class="card-title">{{ s.key }}</h5>
            <h6 class="card-subtitle mb-2 text-muted">{{ s.description }}</h6>
            <p class="card-text"><input type="text" v-model="s.value" ></p>
          </div>
        </div>
      </div>
    </div>


  </div>


</template>

<script>
import Loading from "../basic/Loading.vue";
import LoadIcon from "../../icons/LoadIcon.vue";

export default {
  name: "Settings",
  components: {LoadIcon, Loading},
  data: function () {
    return {
      settings: null,
    }
  },
  sockets: {
    settingAll: function (data) {
      this.settings = data;
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
      this.$socket.emit("settingGetAll");
    }
  }
}
</script>

<style scoped>

</style>