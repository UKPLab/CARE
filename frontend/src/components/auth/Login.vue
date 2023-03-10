<template>
  <form
    class="row g-3 needs-validation"
    novalidate
  >
    <div class="col-md-8 mx-auto my-4">
      <div class="col-md-8 mx-auto">
        <div
          class="text-center"
          style="margin-bottom: 20px"
        >
          <IconAsset
            name="logo"
            :height="200"
          />
        </div>

        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            Login
            <a
              class="btn btn-sm btn-primary"
              @click="$router.push('/register')"
            >Register</a>
          </div>

          <div class="card-body mx-4 my-4">
            <p
              v-if="showError"
              class="text-danger text-center"
            >
              {{ errorMessage }}
            </p>
            <div class="form-group row my-2">
              <label
                class="col-md-4 col-form-label text-md-right"
                for="username"
              >Username</label>
              <div class="col-md-6">
                <input
                  id="username"
                  v-model="username"
                  autocomplete="username"
                  autofocus
                  class="form-control"
                  placeholder="Username or email"
                  required
                  type="text"
                  @blur="setValidity"
                  @input="setValidity"
                >
                <div class="feedback-invalid">
                  Please provide your username or email.
                </div>
              </div>
            </div>


            <div class="form-group row my-2">
              <label
                class="col-md-4 col-form-label text-md-right"
                for="password"
              >Password</label>
              <div class="col-md-6">
                <input
                  id="password"
                  v-model="password"
                  autocomplete="current-password"
                  class="form-control"
                  name="password"
                  placeholder="Password"
                  required
                  type="password"
                  @blur="setValidity"
                  @input="setValidity"
                >
                <div class="feedback-invalid">
                  Please provide your password.
                </div>
              </div>
            </div>

            <div class="col-md-6 offset-md-4 my-4">
              <button
                class="btn btn-primary btn-block"
                type="submit"
                @click="trySubmit"
              >
                Login
              </button>
              <a
                v-if="showGuestLogin"
                class="btn btn-link"
                @click="login_guest()"
              >Login as Guest</a>
            </div>
          </div>
        </div>
        <div
          v-if="showDocs || showFeedback || showProject"
          class="text-center"
        >
          <span v-if="showDocs"><a
            :href="linkDocs"
            target="_blank"
          >Documentation</a></span>
          <span
            v-if="showFeedback && showDocs"
            class="mx-1"
          >&#x2022;</span>
          <span v-if="showFeedback"><a
            :href="linkFeedback"
            target="_blank"
          >Feedback</a></span>
          <span
            v-if="showProject && (showDocs || showFeedback)"
            class="mx-1"
          >&#x2022;</span>
          <span v-if="showProject"><a
            :href="linkProject"
            target="_blank"
          >Project Page</a></span>
        </div>
        <div class="text-center text-secondary">
          {{ copyright }}
        </div>
      </div>
    </div>
  </form>
</template>

<script>
/* Login.vue - login component

This component provides a form to enter user credentials and hereby
login on the server. It links to the registration component.

Author: Dennis Zyska
Co-Author:  Nils Dycke, Carly Gettinger
Source: -
*/
import {mapActions} from "vuex";
import IconAsset from "@/icons/IconAsset.vue";

export default {
  name: "Login",
  components: {IconAsset},
  data() {
    return {
      showError: false,
      errorMessage: "",
      username: "",
      password: ""
    }
  },
  computed: {
    copyright() {
      return window.config['app.config.copyright'];
    },
    showGuestLogin() {
      return window.config['app.login.guest'] === 'true';
    },
    linkDocs() {
      return window.config['app.landing.linkDocs'];
    },
    showDocs() {
      return window.config['app.landing.showDocs'] === 'true' && this.linkDocs !== '';
    },
    linkFeedback() {
      return window.config['app.landing.linkFeedback'];
    },
    showFeedback() {
      return window.config['app.landing.showFeedback'] === 'true' && this.linkFeedback !== '';
    },
    linkProject() {
      return window.config['app.landing.linkProject'];
    },
    showProject() {
      return window.config['app.landing.showProject'] === 'true' && this.linkProject !== '';
    }
  },
  mounted() {
    this.check();
  },
  methods: {
    ...mapActions({login: "auth/login", check: "auth/check"}),
    findNextSiblingWithClass(element, className) {
      var nextSibling = element.nextElementSibling;
      while (nextSibling != null) {
        if (nextSibling.classList.contains(className)) {
          return nextSibling;
        }
        nextSibling = nextSibling.nextElementSibling;
      }
    },

    setValidity() {
      const evtTarget = event.target;
      const targetID = evtTarget.id;
      var valid;
      const feedbackDiv = this.findNextSiblingWithClass(evtTarget, "feedback-invalid");

      if (targetID === "username") {
        valid = (evtTarget.value !== "");
      } else if (targetID === "password") {
        valid = (evtTarget.value.length >= 8);
      }
      if (valid) {
        evtTarget.classList.remove("custom-invalid");
        feedbackDiv.classList.remove("invalid");
      } else {
        if (event.type === 'input') {
          return;
        }
        evtTarget.classList.add("custom-invalid");
        feedbackDiv.classList.add("invalid");
      }
    },
    trySubmit() {
      const form = document.querySelector('form');
      if (form.checkValidity()) {
        event.preventDefault();
        this.login_user();
      }
    },

    async login_user() {
      try {
        await this.login({username: this.username, password: this.password})
        {
          await this.$router.go(0);
          this.showError = false;
        }
      } catch (error) {
        this.showError = true;
        this.errorMessage = error;
        console.log(error);
      }
    },
    register() {
      this.$router.push("/register");
    },
    async login_guest() {
      try {
        await this.login({username: "guest", password: "guestguest"});
        {
          await this.$router.go(0);
          this.showError = false;
        }
      } catch (error) {
        this.showError = true;
        console.log(error);
        this.errorMessage = error;
      }

    },
  }
}
</script>

<style scoped>
.feedback-invalid {
  font-size: 0.75em;
  color: firebrick;
  visibility: hidden;
  padding-top: 4px;
}

.feedback-invalid.invalid {
  visibility: visible;
}

input.custom-invalid {
  border: transparent;
  outline: 1px solid firebrick;
  border-radius: 1px;
}

input:focus.custom-invalid {
  outline: none;
  border: 1px solid #ced4da;
  border-radius: 0.25rem;
}

</style>