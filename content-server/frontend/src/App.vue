<script>
import Upload from "./components/Upload.vue";

export default {
  components: {Upload},
  data() {
    return {
      page_title: "Peer",
      page_subtitle: "Annotation-based peer review"
    }
  }
}
</script>

<template>
    <header>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="https://www.w3schools.com/w3css/4/w3.css">
        <title>{{page_title}} {{page_subtitle}}</title>
        <meta charset="utf-8">
    </header>

    <main>
        <div id="main" style="width:600px;display:inline-block">
            <div class="jumbotron my-auto">
                <h1>{{page_title}}</h1>
                <h2>{{page_subtitle}}</h2>

                <div class="logo">
                  <img src="./assets/images/logo.svg" alt="Logo">
                </div>

               <Upload></Upload>
            </div>
        </div>
    </main>
</template>

<style>
.logo {
    display: block;
    margin-left: auto;
    margin-right: auto;

    width: 60%;
}

img {
        min-width: 200px;
        max-width: calc(min(500px, 100%));
        width: 100%;
}

body {

    font-family: 'Helvetica Neue', Helvetica, Arial, 'Lucida Grande',  sans-serif !default;
    text-align: center;
    font-size: calc(min(20px, 14px + 1.0vw));

    h1 : {
        margin-top: 1.0vh;
        font-size: calc(min(36px, 20px + 1.0vw));
    }

    h2 : {
        margin-top: 10px;
        font-size: calc(min(30px, 16px + 1.0vw));
        color: grey;
    }
}
</style>
