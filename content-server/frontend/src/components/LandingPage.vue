<template>
      <Login></Login>
      <DocumentManagement></DocumentManagement>
</template>

<script>
import Login from "./Login.vue";
import DocumentManagement from "./DocumentManagement.vue";

export default {
  components: {DocumentManagement, Login},
  name: "LandingPage",
  data() {
    return {
      page_title: "Peer",
      page_subtitle: "Annotation-based peer review"
    }
  }
}
</script>

<style>
</style>